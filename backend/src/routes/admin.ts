import { Router } from "express";
import { Order } from "../models/Order";
import { Product } from "../models/Product";
import { Coupon } from "../models/Coupon";
import { Cart } from "../models/Cart";
import { Review } from "../models/Review";
import { requireAdmin, requireAdminPage, AuthRequest } from "../middleware/auth";
import { sendOrderStatusEmail, orderEmailLabel } from "../services/orderEmail";
import { COLLECTION_PAGES } from "../config/collections";
import { toPublicImageUrl } from "../utils/imagePaths";

const router = Router();

const COLLECTION_TAGS: Record<string, string[]> = {
  Formal: ["formal", "office", "suit", "professional", "business"],
  Casual: ["casual", "everyday", "street", "denim", "comfort"],
  "Night Wear": ["night", "nightwear", "lounge", "sleepwear", "pajama"],
  Summer: ["summer", "hot", "beach", "vacation", "light"],
  Spring: ["spring", "floral", "bloom", "garden", "pastel"],
  Partywear: ["party", "glam", "evening", "cocktail", "celebration"],
  Traditional: ["traditional", "lehenga", "saree", "sharara", "wedding", "ethnic", "festive"],
  Winter: ["winter", "cozy", "warm", "layered", "knit"],
};

function slugify(name: string, category: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const col = category.toLowerCase().replace(/\s+/g, "-");
  return `${col}-${base}`;
}

async function uniqueSlug(name: string, category: string): Promise<string> {
  let slug = slugify(name, category);
  let n = 2;
  while (await Product.exists({ slug })) {
    slug = `${slugify(name, category)}-${n++}`;
  }
  return slug;
}

function normalizeProductImage(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return toPublicImageUrl(trimmed.replace(/^\/+/, "").replace(/^images\//, ""));
}

router.get("/admin", requireAdminPage, (_req, res) => {
  res.render("admin");
});

router.get("/api/admin/stats", requireAdmin, async (_req, res) => {
  const [orders, revenue, products, coupons, pending] = await Promise.all([
    Order.countDocuments({ paymentStatus: "paid" }),
    Order.aggregate([
      { $match: { paymentStatus: "paid" } },
      { $group: { _id: null, total: { $sum: "$total" } } },
    ]),
    Product.countDocuments({ active: true }),
    Coupon.countDocuments({ active: true }),
    Order.countDocuments({ paymentStatus: "paid", status: "confirmed" }),
  ]);

  res.json({
    totalOrders: orders,
    revenue: revenue[0]?.total ?? 0,
    activeProducts: products,
    activeCoupons: coupons,
    ordersToShip: pending,
  });
});

function buildDateSeries(days: number): string[] {
  const dates: string[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

function chartLabel(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00`);
  if (days <= 7) return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric" });
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

router.get("/api/admin/analytics", requireAdmin, async (req, res) => {
  const days = Math.min(90, Math.max(7, Number(req.query.days) || 30));
  const since = new Date();
  since.setDate(since.getDate() - (days - 1));
  since.setHours(0, 0, 0, 0);

  const paidMatch = { paymentStatus: "paid" as const };
  const periodMatch = { ...paidMatch, createdAt: { $gte: since } };

  const [dailyAgg, periodSummary, statusBreakdown, topProducts, categoryBreakdown] =
    await Promise.all([
      Order.aggregate([
        { $match: periodMatch },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            revenue: { $sum: "$total" },
            orders: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Order.aggregate([
        { $match: periodMatch },
        {
          $group: {
            _id: null,
            revenue: { $sum: "$total" },
            orders: { $sum: 1 },
          },
        },
      ]),
      Order.aggregate([
        { $match: paidMatch },
        { $group: { _id: "$status", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      Order.aggregate([
        { $match: paidMatch },
        { $unwind: "$items" },
        {
          $group: {
            _id: "$items.name",
            quantity: { $sum: "$items.quantity" },
            revenue: { $sum: { $multiply: ["$items.price", "$items.quantity"] } },
          },
        },
        { $sort: { revenue: -1 } },
        { $limit: 8 },
      ]),
      Order.aggregate([
        { $match: paidMatch },
        { $unwind: "$items" },
        {
          $lookup: {
            from: "products",
            localField: "items.product",
            foreignField: "_id",
            as: "prod",
          },
        },
        { $unwind: { path: "$prod", preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: { $ifNull: ["$prod.category", "Other"] },
            revenue: { $sum: { $multiply: ["$items.price", "$items.quantity"] } },
            quantity: { $sum: "$items.quantity" },
          },
        },
        { $sort: { revenue: -1 } },
      ]),
    ]);

  const dailyMap = new Map(
    dailyAgg.map((d) => [d._id as string, { revenue: d.revenue as number, orders: d.orders as number }])
  );

  const dateSeries = buildDateSeries(days);
  const daily = dateSeries.map((date) => ({
    date,
    label: chartLabel(date, days),
    revenue: dailyMap.get(date)?.revenue ?? 0,
    orders: dailyMap.get(date)?.orders ?? 0,
  }));

  const periodRev = periodSummary[0]?.revenue ?? 0;
  const periodOrders = periodSummary[0]?.orders ?? 0;

  res.json({
    days,
    summary: {
      periodRevenue: periodRev,
      periodOrders,
      avgOrderValue: periodOrders > 0 ? Math.round(periodRev / periodOrders) : 0,
    },
    daily,
    statusBreakdown: statusBreakdown.map((s) => ({
      status: s._id as string,
      count: s.count as number,
    })),
    topProducts: topProducts.map((p) => ({
      name: p._id as string,
      quantity: p.quantity as number,
      revenue: p.revenue as number,
    })),
    categoryBreakdown: categoryBreakdown.map((c) => ({
      category: c._id as string,
      revenue: c.revenue as number,
      quantity: c.quantity as number,
    })),
  });
});

router.get("/api/admin/orders", requireAdmin, async (_req, res) => {
  const orders = await Order.find({ paymentStatus: { $ne: "unpaid" } })
    .sort({ createdAt: -1 })
    .limit(100)
    .populate("user", "fullname email")
    .lean();

  res.json(
    orders.map((o) => ({
      id: o._id.toString(),
      customer: (o.user as { fullname?: string; email?: string })?.fullname ?? "—",
      email: (o.user as { email?: string })?.email ?? "",
      total: o.total,
      subtotal: o.subtotal ?? o.total,
      discount: o.discount ?? 0,
      couponCode: o.couponCode,
      status: o.status,
      paymentStatus: o.paymentStatus,
      trackingId: o.trackingId,
      trackingCarrier: o.trackingCarrier,
      shippedAt: o.shippedAt,
      deliveredAt: o.deliveredAt,
      itemCount: o.items.length,
      items: o.items,
      shipping: o.shipping,
      createdAt: o.createdAt,
    }))
  );
});

router.patch("/api/admin/orders/:id", requireAdmin, async (req: AuthRequest, res) => {
  const order = await Order.findById(req.params.id).populate("user", "email fullname");
  if (!order) return res.status(404).json({ error: "Order not found" });

  const prevStatus = order.status;
  const { status, trackingId, trackingCarrier } = req.body;

  if (status) order.status = status;
  if (trackingId !== undefined) order.trackingId = String(trackingId).trim() || undefined;
  if (trackingCarrier !== undefined) order.trackingCarrier = String(trackingCarrier).trim() || undefined;

  if (status === "shipped" && prevStatus !== "shipped") {
    order.shippedAt = new Date();
    if (!order.trackingId) {
      return res.status(400).json({ error: "Tracking ID required when marking as shipped" });
    }
  }

  if (status === "delivered" && prevStatus !== "delivered") {
    order.deliveredAt = new Date();
  }

  await order.save();

  if (status && status !== prevStatus && (status === "shipped" || status === "delivered")) {
    sendOrderStatusEmail(order._id.toString(), { force: true }).catch((err) =>
      console.error(`[email] ${status} notification failed:`, err instanceof Error ? err.message : err)
    );
  }

  res.json({ message: "Order updated", order: { id: order._id.toString(), status: order.status } });
});

router.post("/api/admin/orders/:id/resend-receipt", requireAdmin, async (req, res) => {
  try {
    const result = await sendOrderStatusEmail(String(req.params.id), { force: true });
    if (!result.sent) {
      return res.status(400).json({ error: result.error || "Could not send email" });
    }
    res.json({ message: orderEmailLabel(result.type!), type: result.type });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Email failed";
    console.error("[admin] Resend receipt failed:", msg);
    const hint = msg.includes("sender") || msg.includes("not verified")
      ? " — Brevo mein EMAIL_FROM verify karo (Senders tab)"
      : "";
    res.status(500).json({ error: msg + hint });
  }
});

router.get("/api/admin/categories", requireAdmin, (_req, res) => {
  res.json(
    Object.entries(COLLECTION_PAGES).map(([slug, c]) => ({
      value: c.category,
      label: c.category,
      collection: slug,
      title: c.title,
    }))
  );
});

router.get("/api/admin/products", requireAdmin, async (_req, res) => {
  const products = await Product.find().sort({ category: 1, name: 1 }).lean();
  res.json(
    products.map((p) => ({
      id: p._id.toString(),
      name: p.name,
      category: p.category,
      price: p.price,
      stock: p.stock ?? 50,
      active: p.active !== false,
      slug: p.slug,
      image: p.image,
    }))
  );
});

router.patch("/api/admin/products/:id", requireAdmin, async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) return res.status(404).json({ error: "Product not found" });

  if (req.body.name != null) product.name = String(req.body.name).trim();
  if (req.body.price != null) product.price = Math.max(0, Number(req.body.price));
  if (req.body.stock != null) product.stock = Math.max(0, Number(req.body.stock));
  if (req.body.active != null) product.active = Boolean(req.body.active);
  if (req.body.category != null) product.category = String(req.body.category).trim();

  await product.save();
  res.json({ message: "Product updated", product: { id: product._id.toString(), name: product.name } });
});

router.post("/api/admin/products", requireAdmin, async (req, res) => {
  const name = String(req.body.name ?? "").trim();
  const category = String(req.body.category ?? "").trim();
  const imageRaw = String(req.body.image ?? "").trim();
  const price = Math.max(0, Number(req.body.price) || 1999);
  const stock = Math.max(0, Number(req.body.stock) ?? 50);
  const active = req.body.active !== false;

  if (!name || !category) {
    return res.status(400).json({ error: "Product name and category required" });
  }

  const validCategories = Object.values(COLLECTION_PAGES).map((c) => c.category);
  if (!validCategories.includes(category)) {
    return res.status(400).json({ error: "Invalid category" });
  }

  const image = normalizeProductImage(imageRaw);
  if (!image) {
    return res.status(400).json({ error: "Image path or URL required (e.g. casual/c1.jpg)" });
  }

  const slug = await uniqueSlug(name, category);
  const tags = [
    name.toLowerCase(),
    category.toLowerCase(),
    ...(COLLECTION_TAGS[category] ?? []),
  ];

  const product = await Product.create({
    name,
    category,
    image,
    slug,
    price,
    stock,
    active,
    tags,
  });

  res.status(201).json({
    message: "Product created",
    product: {
      id: product._id.toString(),
      name: product.name,
      slug: product.slug,
    },
  });
});

router.delete("/api/admin/products/:id", requireAdmin, async (req, res) => {
  const id = String(req.params.id);
  const product = await Product.findById(id);
  if (!product) return res.status(404).json({ error: "Product not found" });

  await Promise.all([
    Product.findByIdAndDelete(id),
    Cart.updateMany({}, { $pull: { items: { product: id } } }),
    Review.deleteMany({ product: id }),
  ]);

  res.json({ message: "Product deleted" });
});

router.get("/api/admin/coupons", requireAdmin, async (_req, res) => {
  const coupons = await Coupon.find().sort({ createdAt: -1 }).lean();
  res.json(
    coupons.map((c) => ({
      id: c._id.toString(),
      code: c.code,
      type: c.type,
      value: c.value,
      minOrder: c.minOrder,
      maxUses: c.maxUses,
      usedCount: c.usedCount,
      expiresAt: c.expiresAt,
      active: c.active,
      description: c.description,
    }))
  );
});

router.post("/api/admin/coupons", requireAdmin, async (req, res) => {
  const code = String(req.body.code ?? "").trim().toUpperCase();
  const type = req.body.type === "fixed" ? "fixed" : "percent";
  const value = Number(req.body.value);
  const minOrder = Number(req.body.minOrder) || 0;
  const maxUses = req.body.maxUses ? Number(req.body.maxUses) : null;
  const description = String(req.body.description ?? "").trim();
  const expiresAt = req.body.expiresAt ? new Date(req.body.expiresAt) : null;

  if (!code || !value) return res.status(400).json({ error: "Code and value required" });
  if (type === "percent" && (value < 1 || value > 90)) {
    return res.status(400).json({ error: "Percent must be 1–90" });
  }

  const existing = await Coupon.findOne({ code });
  if (existing) return res.status(409).json({ error: "Coupon code already exists" });

  const coupon = await Coupon.create({
    code,
    type,
    value,
    minOrder,
    maxUses,
    expiresAt,
    description,
    active: true,
  });

  res.status(201).json({ message: "Coupon created", id: coupon._id.toString() });
});

router.patch("/api/admin/coupons/:id", requireAdmin, async (req, res) => {
  const coupon = await Coupon.findById(req.params.id);
  if (!coupon) return res.status(404).json({ error: "Coupon not found" });

  if (req.body.active != null) coupon.active = Boolean(req.body.active);
  if (req.body.value != null) coupon.value = Number(req.body.value);
  if (req.body.minOrder != null) coupon.minOrder = Number(req.body.minOrder);
  if (req.body.maxUses != null) coupon.maxUses = req.body.maxUses ? Number(req.body.maxUses) : null;
  if (req.body.description != null) coupon.description = String(req.body.description);
  if (req.body.expiresAt != null) {
    coupon.expiresAt = req.body.expiresAt ? new Date(req.body.expiresAt) : null;
  }

  await coupon.save();
  res.json({ message: "Coupon updated" });
});

router.delete("/api/admin/coupons/:id", requireAdmin, async (req, res) => {
  await Coupon.findByIdAndDelete(req.params.id);
  res.json({ message: "Coupon deleted" });
});

export default router;
