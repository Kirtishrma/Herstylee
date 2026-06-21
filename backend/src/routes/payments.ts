import { Router, Request, Response } from "express";
import Stripe from "stripe";
import { Order } from "../models/Order";
import { User } from "../models/User";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { buildCartCheckout, clearUserCart } from "../utils/cartCheckout";
import { convertInrToUsd, formatUsd } from "../services/currency";
import { createCheckoutSession, getStripe, isStripeConfigured } from "../services/stripe";
import { sendOrderStatusEmail } from "../services/orderEmail";
import { validateCoupon, incrementCouponUsage } from "../services/coupons";
import { signToken } from "../utils/jwt";

const router = Router();

export async function sendReceiptIfNeeded(orderId: string, force = false): Promise<boolean> {
  const result = await sendOrderStatusEmail(orderId, { force });
  return result.sent;
}

export async function confirmPaidOrder(
  orderId: string,
  session: Stripe.Checkout.Session
): Promise<boolean> {
  const order = await Order.findById(orderId);
  if (!order) return false;

  const wasAlreadyPaid = order.paymentStatus === "paid";

  if (!wasAlreadyPaid) {
    order.status = "confirmed";
    order.paymentStatus = "paid";
    order.stripeSessionId = session.id;
    order.stripePaymentIntentId =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id;

    const metaUsd = session.metadata?.totalUsd;
    const metaRate = session.metadata?.exchangeRate;
    if (metaUsd) order.totalUsd = Number(metaUsd);
    if (metaRate) order.exchangeRate = Number(metaRate);

    await order.save();
    await clearUserCart(order.user.toString());
    await incrementCouponUsage(order.couponId);
  }

  try {
    await sendReceiptIfNeeded(orderId);
  } catch (err) {
    console.error("[email] Order receipt failed:", err instanceof Error ? err.message : err);
  }

  return true;
}

/** Stripe webhook — mount with express.raw() in index.ts */
export async function stripeWebhookHandler(req: Request, res: Response) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return res.status(503).send("Webhook secret not configured");
  }

  const sig = req.headers["stripe-signature"];
  if (!sig || typeof sig !== "string") {
    return res.status(400).send("Missing stripe-signature");
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(req.body, sig, secret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid signature";
    return res.status(400).send(`Webhook Error: ${message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const orderId = session.metadata?.orderId;
    if (orderId && session.payment_status === "paid") {
      await confirmPaidOrder(orderId, session);
    }
  }

  res.json({ received: true });
}

router.get("/api/payments/preview", requireAuth, async (req: AuthRequest, res) => {
  const checkout = await buildCartCheckout(req.user!.id);
  if (!checkout) return res.status(400).json({ error: "Cart is empty" });

  const couponCode = String(req.query.coupon ?? "").trim();
  let subtotal = checkout.totalInr;
  let discount = 0;
  let total = subtotal;

  if (couponCode) {
    const result = await validateCoupon(couponCode, subtotal);
    if (!result.ok) return res.status(400).json({ error: result.error });
    discount = result.data.discount;
    total = result.data.total;
  }

  const converted = await convertInrToUsd(total);
  res.json({
    subtotal,
    discount,
    total,
    couponCode: couponCode || null,
    totalInr: total,
    totalUsd: converted.totalUsd,
    rate: converted.rate,
    stripeEnabled: isStripeConfigured(),
    formattedInr: `₹${total.toLocaleString("en-IN")}`,
    formattedUsd: formatUsd(converted.totalUsd),
  });
});

router.post("/api/payments/create-session", requireAuth, async (req: AuthRequest, res) => {
  if (!isStripeConfigured()) {
    return res.status(503).json({ error: "Stripe is not configured. Add STRIPE_SECRET_KEY to .env" });
  }

  const { fullname, phone, address, city, pincode, couponCode } = req.body;
  if (!fullname || !phone || !address || !city || !pincode) {
    return res.status(400).json({ error: "All shipping fields required" });
  }

  const checkout = await buildCartCheckout(req.user!.id);
  if (!checkout) return res.status(400).json({ error: "Cart is empty" });

  let subtotal = checkout.totalInr;
  let discount = 0;
  let total = subtotal;
  let appliedCoupon: { id: unknown; code: string } | null = null;

  if (couponCode) {
    const result = await validateCoupon(String(couponCode), subtotal);
    if (!result.ok) return res.status(400).json({ error: result.error });
    discount = result.data.discount;
    total = result.data.total;
    appliedCoupon = { id: result.data.coupon._id, code: result.data.coupon.code };
  }

  const user = await User.findById(req.user!.id).select("email").lean();
  if (!user?.email) return res.status(400).json({ error: "User email not found" });

  const converted = await convertInrToUsd(total);

  const order = await Order.create({
    user: req.user!.id,
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
    shipping: { fullname, phone, address, city, pincode },
  });

  try {
    const session = await createCheckoutSession({
      orderId: order._id.toString(),
      userId: req.user!.id,
      userEmail: user.email,
      totalInr: total,
      itemCount: checkout.orderItems.length,
    });

    order.stripeSessionId = session.sessionId;
    await order.save();

    res.json({
      url: session.url,
      subtotal,
      discount,
      total,
      totalInr: total,
      totalUsd: session.totalUsd,
      rate: session.rate,
      formattedInr: `₹${total.toLocaleString("en-IN")}`,
      formattedUsd: formatUsd(session.totalUsd),
    });
  } catch (err) {
    await Order.findByIdAndDelete(order._id);
    const message = err instanceof Error ? err.message : "Payment session failed";
    res.status(500).json({ error: message });
  }
});

router.get("/api/payments/verify-session", requireAuth, async (req: AuthRequest, res) => {
  const sessionId = String(req.query.session_id ?? "");
  if (!sessionId) return res.status(400).json({ error: "session_id required" });
  if (!isStripeConfigured()) return res.status(503).json({ error: "Stripe not configured" });

  try {
    const session = await getStripe().checkout.sessions.retrieve(sessionId);
    if (session.metadata?.userId !== req.user!.id) {
      return res.status(403).json({ error: "Session does not belong to this user" });
    }
    if (session.payment_status === "paid" && session.metadata?.orderId) {
      await confirmPaidOrder(session.metadata.orderId, session);
    }
    const user = await User.findById(req.user!.id);
    res.json({
      paid: session.payment_status === "paid",
      orderId: session.metadata?.orderId,
      token: session.payment_status === "paid" && user ? signToken(user) : null,
    });
  } catch {
    res.status(400).json({ error: "Invalid session" });
  }
});

export default router;