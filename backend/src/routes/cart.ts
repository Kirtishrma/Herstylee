import { Router } from "express";
import mongoose from "mongoose";
import { Cart } from "../models/Cart";
import { Product } from "../models/Product";
import { normalizeSize } from "../config/sizes";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { resetAbandonedReminder } from "../services/abandonedCart";

const router = Router();

function getProductId(productRef: unknown): string {
  if (!productRef) return "";
  if (typeof productRef === "object" && productRef !== null && "_id" in productRef) {
    return (productRef as { _id: { toString(): string } })._id.toString();
  }
  return String(productRef);
}

async function getOrCreateCart(userId: string) {
  let cart = await Cart.findOne({ user: userId }).populate("items.product");
  if (!cart) {
    cart = await Cart.create({ user: userId, items: [] });
    await cart.populate("items.product");
  }
  return cart;
}

function formatCart(cart: Awaited<ReturnType<typeof getOrCreateCart>>) {
  const items = cart.items
    .filter((item) => item.product)
    .map((item) => {
      const p = item.product as unknown as {
        _id: { toString(): string };
        name: string;
        slug: string;
        image: string;
        price: number;
        category: string;
      };
      return {
        productId: p._id.toString(),
        name: p.name,
        slug: p.slug,
        image: p.image,
        price: p.price,
        category: p.category,
        quantity: item.quantity,
        size: item.size || "M",
        subtotal: p.price * item.quantity,
      };
    });

  const total = items.reduce((sum, i) => sum + i.subtotal, 0);
  return { items, total, count: items.reduce((s, i) => s + i.quantity, 0) };
}

router.get("/api/cart", requireAuth, async (req: AuthRequest, res) => {
  const cart = await getOrCreateCart(req.user!.id);
  res.json(formatCart(cart));
});

router.post("/api/cart", requireAuth, async (req: AuthRequest, res) => {
  const productId = String(req.body.productId ?? "");
  const quantity = Math.max(1, Number(req.body.quantity) || 1);
  const size = normalizeSize(req.body.size);

  const product = await Product.findById(productId);
  if (!product) return res.status(404).json({ error: "Product not found" });

  const cart = await getOrCreateCart(req.user!.id);
  const existing = cart.items.find(
    (i) => getProductId(i.product) === productId && (i.size || "M") === size
  );

  if (existing) {
    existing.quantity += quantity;
  } else {
    cart.items.push({ product: product._id, quantity, size });
  }

  await cart.save();
  await resetAbandonedReminder(req.user!.id);
  await cart.populate("items.product");
  res.json({ message: "Added to cart", ...formatCart(cart) });
});

router.patch("/api/cart/:productId", requireAuth, async (req: AuthRequest, res) => {
  const quantity = Number(req.body.quantity);
  if (quantity < 1) return res.status(400).json({ error: "Invalid quantity" });

  const productId = req.params.productId;
  const size = normalizeSize(req.query.size ?? req.body.size);
  const cart = await getOrCreateCart(req.user!.id);
  const item = cart.items.find(
    (i) => getProductId(i.product) === productId && (i.size || "M") === size
  );
  if (!item) return res.status(404).json({ error: "Item not in cart" });

  item.quantity = quantity;
  await cart.save();
  await resetAbandonedReminder(req.user!.id);
  await cart.populate("items.product");
  res.json(formatCart(cart));
});

router.delete("/api/cart/:productId", requireAuth, async (req: AuthRequest, res) => {
  const productId = String(req.params.productId);
  const size = normalizeSize(req.query.size ?? req.body?.size);

  const cart = await getOrCreateCart(req.user!.id);
  cart.items = cart.items.filter(
    (i) => !(getProductId(i.product) === productId && (i.size || "M") === size)
  );
  await cart.save();
  await resetAbandonedReminder(req.user!.id);
  await cart.populate("items.product");

  res.json(formatCart(cart));
});

router.post("/api/cart/bundle", requireAuth, async (req: AuthRequest, res) => {
  const productIds = Array.isArray(req.body.productIds) ? req.body.productIds.map(String) : [];
  if (!productIds.length) {
    return res.status(400).json({ error: "No products in outfit" });
  }

  const cart = await getOrCreateCart(req.user!.id);
  let added = 0;

  for (const productId of productIds.slice(0, 6)) {
    if (!mongoose.Types.ObjectId.isValid(productId)) continue;
    const product = await Product.findById(productId);
    if (!product) continue;

    const size = normalizeSize(req.body.size);
    const existing = cart.items.find(
      (i) => getProductId(i.product) === productId && (i.size || "M") === size
    );

    if (existing) {
      existing.quantity += 1;
    } else {
      cart.items.push({ product: product._id, quantity: 1, size });
    }
    added++;
  }

  if (!added) return res.status(400).json({ error: "Could not add outfit items" });

  await cart.save();
  await resetAbandonedReminder(req.user!.id);
  await cart.populate("items.product");
  res.json({ message: `Added ${added} item(s) to cart`, added, ...formatCart(cart) });
});

export default router;
