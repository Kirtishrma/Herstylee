import { Router } from "express";
import mongoose from "mongoose";
import { Wishlist } from "../models/Wishlist";
import { Product } from "../models/Product";
import { requireAuth, AuthRequest } from "../middleware/auth";

const router = Router();

async function getOrCreateWishlist(userId: string) {
  let list = await Wishlist.findOne({ user: userId });
  if (!list) list = await Wishlist.create({ user: userId, products: [] });
  return list;
}

router.get("/api/wishlist", requireAuth, async (req: AuthRequest, res) => {
  const list = await getOrCreateWishlist(req.user!.id);
  const products = await Product.find({ _id: { $in: list.products } }).lean();
  res.json({
    count: products.length,
    products: products.map((p) => ({
      id: p._id.toString(),
      name: p.name,
      slug: p.slug,
      image: p.image,
      price: p.price,
      category: p.category,
    })),
  });
});

router.post("/api/wishlist/toggle", requireAuth, async (req: AuthRequest, res) => {
  const productId = String(req.body.productId ?? "");
  if (!mongoose.Types.ObjectId.isValid(productId)) {
    return res.status(400).json({ error: "Invalid product" });
  }

  const product = await Product.findById(productId);
  if (!product) return res.status(404).json({ error: "Product not found" });

  const list = await getOrCreateWishlist(req.user!.id);
  const idx = list.products.findIndex((id) => id.toString() === productId);

  let added = false;
  if (idx >= 0) {
    list.products.splice(idx, 1);
  } else {
    list.products.push(product._id);
    added = true;
  }

  await list.save();
  res.json({ added, removed: !added, count: list.products.length });
});

router.get("/api/wishlist/check/:productId", requireAuth, async (req: AuthRequest, res) => {
  const list = await getOrCreateWishlist(req.user!.id);
  const saved = list.products.some((id) => id.toString() === req.params.productId);
  res.json({ saved });
});

export default router;
