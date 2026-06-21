import { Router } from "express";
import bcrypt from "bcryptjs";
import { User } from "../models/User";
import { signToken } from "../utils/jwt";
import { buildGuestCartCheckout } from "../utils/cartCheckout";
import { convertInrToUsd, formatUsd } from "../services/currency";
import { validateCoupon } from "../services/coupons";
import { isStripeConfigured } from "../services/stripe";
import { createGuestCheckoutSession, verifyGuestSession } from "./guestPayments";

const router = Router();

function parseGuestItems(body: unknown): { productId: string; quantity: number; size: string }[] {
  if (!Array.isArray(body)) return [];
  return body
    .map((item) => ({
      productId: String((item as { productId?: string }).productId ?? "").trim(),
      quantity: Math.max(1, Number((item as { quantity?: number }).quantity) || 1),
      size: String((item as { size?: string }).size ?? "M").trim() || "M",
    }))
    .filter((item) => item.productId);
}

async function findOrCreateGuestUser(email: string, fullname: string) {
  const normalized = email.toLowerCase().trim();
  let user = await User.findOne({ email: normalized });
  if (user) return user;

  const randomPass = await bcrypt.hash(`${Date.now()}-${Math.random()}`, 10);
  user = await User.create({
    fullname: fullname.trim() || normalized.split("@")[0],
    email: normalized,
    password: randomPass,
  });
  return user;
}

router.post("/api/guest/cart/summary", async (req, res) => {
  const items = parseGuestItems(req.body.items);
  if (!items.length) return res.status(400).json({ error: "Cart is empty" });

  const checkout = await buildGuestCartCheckout(items);
  if (!checkout) return res.status(400).json({ error: "No valid products in cart" });

  const formatted = checkout.orderItems.map((item) => ({
    productId: item.product.toString(),
    name: item.name,
    slug: item.slug,
    image: item.image,
    price: item.price,
    quantity: item.quantity,
    size: item.size,
    subtotal: item.price * item.quantity,
  }));

  res.json({
    items: formatted,
    total: checkout.totalInr,
    count: formatted.reduce((s, i) => s + i.quantity, 0),
  });
});

router.post("/api/guest/payments/preview", async (req, res) => {
  const items = parseGuestItems(req.body.items);
  const checkout = await buildGuestCartCheckout(items);
  if (!checkout) return res.status(400).json({ error: "Cart is empty" });

  const couponCode = String(req.body.coupon ?? req.query?.coupon ?? "").trim();
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

router.post("/api/guest/payments/create-session", async (req, res) => {
  if (!isStripeConfigured()) {
    return res.status(503).json({ error: "Stripe is not configured. Add STRIPE_SECRET_KEY to .env" });
  }

  const items = parseGuestItems(req.body.items);
  const email = String(req.body.email ?? "").trim().toLowerCase();
  const { fullname, phone, address, city, pincode, couponCode } = req.body;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: "Valid email is required" });
  }
  if (!fullname || !phone || !address || !city || !pincode) {
    return res.status(400).json({ error: "All shipping fields required" });
  }
  if (!/^\d{6}$/.test(String(pincode))) {
    return res.status(400).json({ error: "Pincode must be 6 digits" });
  }

  const checkout = await buildGuestCartCheckout(items);
  if (!checkout) return res.status(400).json({ error: "Cart is empty" });

  try {
    const user = await findOrCreateGuestUser(email, String(fullname));
    const result = await createGuestCheckoutSession({
      user,
      checkout,
      shipping: {
        fullname: String(fullname).trim(),
        phone: String(phone).trim(),
        address: String(address).trim(),
        city: String(city).trim(),
        pincode: String(pincode).trim(),
      },
      couponCode: couponCode ? String(couponCode) : undefined,
    });

    res.json({
      url: result.url,
      token: signToken(user),
      ...result.totals,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Payment session failed";
    res.status(500).json({ error: message });
  }
});

router.get("/api/guest/payments/verify-session", async (req, res) => {
  const sessionId = String(req.query.session_id ?? "");
  if (!sessionId) return res.status(400).json({ error: "session_id required" });

  try {
    const result = await verifyGuestSession(sessionId);
    res.json(result);
  } catch {
    res.status(400).json({ error: "Invalid session" });
  }
});

export default router;
