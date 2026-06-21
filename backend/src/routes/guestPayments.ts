import { Order } from "../models/Order";
import { IUser, User } from "../models/User";
import { CartCheckoutData } from "../utils/cartCheckout";
import { convertInrToUsd, formatUsd } from "../services/currency";
import { createCheckoutSession, getStripe, isStripeConfigured } from "../services/stripe";
import { validateCoupon } from "../services/coupons";
import { confirmPaidOrder } from "./payments";
import { signToken } from "../utils/jwt";

interface GuestShipping {
  fullname: string;
  phone: string;
  address: string;
  city: string;
  pincode: string;
}

export async function createGuestCheckoutSession(opts: {
  user: IUser;
  checkout: CartCheckoutData;
  shipping: GuestShipping;
  couponCode?: string;
}) {
  const { user, checkout, shipping, couponCode } = opts;

  let subtotal = checkout.totalInr;
  let discount = 0;
  let total = subtotal;
  let appliedCoupon: { id: unknown; code: string } | null = null;

  if (couponCode) {
    const result = await validateCoupon(couponCode, subtotal);
    if (!result.ok) throw new Error(result.error);
    discount = result.data.discount;
    total = result.data.total;
    appliedCoupon = { id: result.data.coupon._id, code: result.data.coupon.code };
  }

  const converted = await convertInrToUsd(total);

  const order = await Order.create({
    user: user._id,
    items: checkout.orderItems,
    subtotal,
    discount,
    total,
    couponCode: appliedCoupon?.code,
    couponId: appliedCoupon?.id,
    totalUsd: converted.totalUsd,
    exchangeRate: converted.rate,
    status: "pending",
    paymentStatus: "unpaid",
    shipping,
  });

  try {
    const session = await createCheckoutSession({
      orderId: order._id.toString(),
      userId: user._id.toString(),
      userEmail: user.email,
      totalInr: total,
      itemCount: checkout.orderItems.length,
    });

    order.stripeSessionId = session.sessionId;
    await order.save();

    return {
      url: session.url,
      totals: {
        subtotal,
        discount,
        total,
        totalInr: total,
        totalUsd: session.totalUsd,
        rate: session.rate,
        formattedInr: `₹${total.toLocaleString("en-IN")}`,
        formattedUsd: formatUsd(session.totalUsd),
      },
    };
  } catch (err) {
    await Order.findByIdAndDelete(order._id);
    throw err;
  }
}

export async function verifyGuestSession(sessionId: string) {
  if (!isStripeConfigured()) throw new Error("Stripe not configured");

  const session = await getStripe().checkout.sessions.retrieve(sessionId);
  const userId = session.metadata?.userId;
  if (!userId) throw new Error("Invalid session");

  if (session.payment_status === "paid" && session.metadata?.orderId) {
    await confirmPaidOrder(session.metadata.orderId, session);
  }

  const user = await User.findById(userId);
  if (!user) throw new Error("User not found");

  return {
    paid: session.payment_status === "paid",
    orderId: session.metadata?.orderId,
    token: session.payment_status === "paid" ? signToken(user) : null,
  };
}

export type { GuestShipping };
