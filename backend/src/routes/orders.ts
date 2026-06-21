import { Router } from "express";
import { Order } from "../models/Order";
import { Product } from "../models/Product";
import { requireAuth, AuthRequest } from "../middleware/auth";

const router = Router();

router.get("/api/orders", requireAuth, async (req: AuthRequest, res) => {
  const orders = await Order.find({ user: req.user!.id, paymentStatus: { $ne: "unpaid" } })
    .sort({ createdAt: -1 })
    .lean();

  res.json(
    orders.map((o) => ({
      id: o._id.toString(),
      subtotal: o.subtotal ?? o.total,
      discount: o.discount ?? 0,
      couponCode: o.couponCode,
      total: o.total,
      totalUsd: o.totalUsd,
      status: o.status,
      paymentStatus: o.paymentStatus,
      trackingId: o.trackingId,
      trackingCarrier: o.trackingCarrier,
      shippedAt: o.shippedAt,
      deliveredAt: o.deliveredAt,
      itemCount: o.items.length,
      items: o.items.map((i) => ({
        productId: i.product?.toString?.() ?? String(i.product),
        name: i.name,
        image: i.image,
        price: i.price,
        quantity: i.quantity,
        size: i.size || "M",
      })),
      shipping: o.shipping,
      createdAt: o.createdAt,
    }))
  );
});

router.get("/api/orders/purchased-products", requireAuth, async (req: AuthRequest, res) => {
  const orders = await Order.find({
    user: req.user!.id,
    paymentStatus: { $ne: "unpaid" },
    status: { $ne: "cancelled" },
  })
    .sort({ createdAt: -1 })
    .select("items createdAt")
    .lean();

  const seen = new Map<string, Date>();

  for (const order of orders) {
    for (const item of order.items) {
      const productId = item.product.toString();
      if (!seen.has(productId)) {
        seen.set(productId, order.createdAt);
      }
    }
  }

  if (!seen.size) {
    return res.json([]);
  }

  const productIds = [...seen.keys()];
  const products = await Product.find({
    _id: { $in: productIds },
    active: { $ne: false },
  })
    .select("name category image price slug")
    .lean();

  const productMap = new Map(products.map((p) => [p._id.toString(), p]));

  const result = productIds
    .filter((id) => productMap.has(id))
    .slice(0, 8)
    .map((id) => {
      const p = productMap.get(id)!;
      return {
        id: p._id.toString(),
        name: p.name,
        slug: p.slug,
        image: p.image,
        price: p.price,
        category: p.category,
        purchasedAt: seen.get(id),
      };
    });

  res.json(result);
});

router.post("/api/orders/:id/cancel", requireAuth, async (req: AuthRequest, res) => {
  const order = await Order.findOne({ _id: req.params.id, user: req.user!.id });
  if (!order) return res.status(404).json({ error: "Order not found" });

  if (order.status === "cancelled") {
    return res.status(400).json({ error: "Order is already cancelled" });
  }

  if (["shipped", "delivered"].includes(order.status)) {
    return res.status(400).json({ error: "This order can no longer be cancelled" });
  }

  order.status = "cancelled";
  await order.save();

  res.json({
    message: "Order cancelled successfully",
    id: order._id.toString(),
    status: order.status,
  });
});

router.get("/api/orders/:id", requireAuth, async (req: AuthRequest, res) => {
  const order = await Order.findOne({ _id: req.params.id, user: req.user!.id }).lean();
  if (!order) return res.status(404).json({ error: "Order not found" });
  res.json(order);
});

router.get("/api/orders/config/payment", (_req, res) => {
  res.json({ stripeEnabled: Boolean(process.env.STRIPE_SECRET_KEY) });
});

export default router;
