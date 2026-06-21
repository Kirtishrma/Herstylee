import { Order } from "../models/Order";
import { User } from "../models/User";
import {
  sendOrderDeliveredEmail,
  sendOrderReceiptEmail,
  sendOrderShippedEmail,
} from "./email";

async function getOrderRecipient(order: InstanceType<typeof Order>) {
  const user = await User.findById(order.user).select("email fullname").lean();
  if (!user?.email) return null;
  return { email: user.email, name: user.fullname || order.shipping.fullname || "Customer" };
}

export type OrderEmailType = "confirmed" | "shipped" | "delivered";

/** Send the email that matches the order's current status. */
export async function sendOrderStatusEmail(
  orderId: string,
  opts: { force?: boolean } = {}
): Promise<{ sent: boolean; type?: OrderEmailType; error?: string }> {
  const force = opts.force ?? false;
  const order = await Order.findById(orderId);
  if (!order || order.paymentStatus !== "paid") {
    return { sent: false, error: "Order not paid or not found" };
  }

  const recipient = await getOrderRecipient(order);
  if (!recipient) {
    return { sent: false, error: "Customer email missing" };
  }

  const { email, name } = recipient;
  const id = order._id.toString();

  if (order.status === "delivered") {
    await sendOrderDeliveredEmail(email, name, {
      orderId: id,
      deliveredAt: order.deliveredAt ?? new Date(),
      total: order.total,
      discount: order.discount ?? 0,
      couponCode: order.couponCode,
      shipping: order.shipping,
      items: order.items.map((i) => ({
        name: i.name,
        size: i.size,
        quantity: i.quantity,
        price: i.price,
      })),
    });
    console.log(`[email] Delivered notification sent to ${email} for order #${id.slice(-6)}`);
    return { sent: true, type: "delivered" };
  }

  if (order.status === "shipped") {
    if (!order.trackingId) {
      return { sent: false, error: "Add a tracking ID before sending shipped email" };
    }
    await sendOrderShippedEmail(email, name, {
      orderId: id,
      trackingId: order.trackingId,
      trackingCarrier: order.trackingCarrier,
      shipping: { fullname: order.shipping.fullname, city: order.shipping.city },
    });
    console.log(`[email] Shipped notification sent to ${email} for order #${id.slice(-6)}`);
    return { sent: true, type: "shipped" };
  }

  if (order.status === "cancelled") {
    return { sent: false, error: "Cannot send email for cancelled orders" };
  }

  // confirmed, pending, or other paid states → receipt
  if (order.receiptEmailSent && !force) {
    return { sent: false, error: "Receipt already sent — use Resend email to send again" };
  }

  await sendOrderReceiptEmail(email, name, {
    orderId: id,
    subtotal: order.subtotal ?? order.total,
    discount: order.discount ?? 0,
    couponCode: order.couponCode,
    total: order.total,
    totalUsd: order.totalUsd,
    items: order.items.map((i) => ({
      name: i.name,
      size: i.size,
      quantity: i.quantity,
      price: i.price,
    })),
    shipping: order.shipping,
    paidAt: order.updatedAt ?? new Date(),
  });

  order.receiptEmailSent = true;
  await order.save();
  console.log(`[email] Receipt sent to ${email} for order #${id.slice(-6)}`);
  return { sent: true, type: "confirmed" };
}

export function orderEmailLabel(type: OrderEmailType): string {
  if (type === "delivered") return "Delivered email sent!";
  if (type === "shipped") return "Shipped email sent!";
  return "Order confirmation email sent!";
}
