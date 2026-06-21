import { Router } from "express";
import { Types } from "mongoose";
import { Review } from "../models/Review";
import { Product } from "../models/Product";
import { requireAuth, AuthRequest } from "../middleware/auth";

const router = Router();

router.get("/api/products/:productId/reviews", async (req, res) => {
  const productId = String(req.params.productId);
  if (!Types.ObjectId.isValid(productId)) {
    return res.status(400).json({ error: "Invalid product id" });
  }

  const oid = new Types.ObjectId(productId);

  const [reviews, stats] = await Promise.all([
    Review.find({ product: oid }).sort({ createdAt: -1 }).limit(20).lean(),
    Review.aggregate([
      { $match: { product: oid } },
      { $group: { _id: null, average: { $avg: "$rating" }, count: { $sum: 1 } } },
    ]),
  ]);

  const { average = 0, count = 0 } = stats[0] ?? {};

  res.json({
    reviews: reviews.map((r) => ({
      id: r._id.toString(),
      userName: r.userName,
      rating: r.rating,
      comment: r.comment,
      createdAt: r.createdAt,
    })),
    average: count ? Math.round(average * 10) / 10 : 0,
    count,
  });
});

router.post("/api/products/:productId/reviews", requireAuth, async (req: AuthRequest, res) => {
  try {
    const product = await Product.findById(req.params.productId);
    if (!product) return res.status(404).json({ error: "Product not found" });

    const rating = Number(req.body.rating);
    const comment = String(req.body.comment ?? "").trim();

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: "Rating must be between 1 and 5" });
    }
    if (!comment || comment.length < 5) {
      return res.status(400).json({ error: "Review must be at least 5 characters" });
    }

    const existing = await Review.findOne({ product: product._id, user: req.user!.id });
    if (existing) {
      existing.rating = rating;
      existing.comment = comment;
      existing.userName = req.user!.fullname;
      await existing.save();
      return res.json({ message: "Review updated" });
    }

    await Review.create({
      product: product._id,
      user: req.user!.id,
      userName: req.user!.fullname,
      rating,
      comment,
    });

    res.status(201).json({ message: "Review posted" });
  } catch {
    res.status(500).json({ error: "Could not post review" });
  }
});

export default router;
