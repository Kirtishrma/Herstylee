import { Router, Response } from "express";
import { Product } from "../models/Product";

const router = Router();
const PAGE_SIZE = 12;

const SORT_OPTIONS: Record<string, Record<string, 1 | -1>> = {
  price_asc: { price: 1 },
  price_desc: { price: -1 },
  name_asc: { name: 1 },
  newest: { createdAt: -1 },
};

function render(res: Response, view: string, data: Record<string, unknown> = {}) {
  res.render(view, data);
}

function buildSearchQuery(req: { query: Record<string, unknown> }) {
  const q = String(req.query.q ?? "").trim();
  const category = String(req.query.category ?? "").trim();
  const minPrice = Number(req.query.minPrice) || 0;
  const maxPrice = Number(req.query.maxPrice) || 999999;
  const sort = String(req.query.sort ?? "price_asc");
  const page = Math.max(1, Number(req.query.page) || 1);

  const filter: Record<string, unknown> = {
    price: { $gte: minPrice, $lte: maxPrice },
    active: { $ne: false },
  };

  if (category) filter.category = category;
  if (q) {
    filter.$or = [
      { name: { $regex: q, $options: "i" } },
      { category: { $regex: q, $options: "i" } },
      { tags: { $regex: q, $options: "i" } },
    ];
  }

  return { q, category, minPrice, maxPrice, sort, page, filter };
}

router.get("/search", async (req, res) => {
  const { q, category, minPrice, maxPrice, sort, page, filter } = buildSearchQuery(req);
  const sortSpec = SORT_OPTIONS[sort] ?? SORT_OPTIONS.price_asc;

  const [total, products, categories] = await Promise.all([
    Product.countDocuments(filter),
    Product.find(filter)
      .sort(sortSpec)
      .skip((page - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE)
      .lean(),
    Product.distinct("category"),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  render(res, "search", {
    q,
    category,
    minPrice: minPrice || "",
    maxPrice: maxPrice === 999999 ? "" : maxPrice,
    sort,
    page,
    totalPages,
    products,
    categories,
    count: total,
  });
});

router.get("/cart", (_req, res) => render(res, "cart"));
router.get("/wishlist", (_req, res) => render(res, "wishlist"));
router.get("/checkout", (_req, res) => render(res, "checkout"));
router.get("/orders", (req, res) => render(res, "orders", { query: req.query }));

export default router;
