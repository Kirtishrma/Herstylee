import { Router, Response } from "express";
import { Product } from "../models/Product";
import { COLLECTION_PAGES } from "../config/collections";

const router = Router();

function render(res: Response, view: string, data: Record<string, unknown> = {}) {
  res.render(view, data);
}

router.get("/", async (_req, res) => {
  const picks = await Promise.all([
    Product.findOne({ category: "Casual", slug: /california-weekend/i }),
    Product.findOne({ category: "Formal", slug: /classic-office/i }),
    Product.findOne({ category: "Traditional", slug: /blush-rosette/i }),
    Product.findOne({ category: "Partywear", slug: /blush-rose/i }),
  ]);

  const fallback = await Promise.all([
    Product.findOne({ category: "Casual" }).sort({ price: -1 }),
    Product.findOne({ category: "Formal" }).sort({ price: -1 }),
    Product.findOne({ category: "Traditional" }).sort({ price: -1 }),
    Product.findOne({ category: "Partywear" }).sort({ price: -1 }),
  ]);

  const featured = picks.map((p, i) => p || fallback[i]).filter(Boolean);

  render(res, "home", { featured });
});

router.get("/about", (_req, res) => render(res, "about"));
router.get("/stylist", (_req, res) => render(res, "stylist"));
router.get("/login", (req, res) => render(res, "login", { error: req.query.error ?? null }));
router.get("/signin", (_req, res) => render(res, "signin", { error: null }));
router.get("/forgot-password", (_req, res) => render(res, "forgot-password"));
router.get("/reset-password", (_req, res) => render(res, "reset-password"));

for (const [path, config] of Object.entries(COLLECTION_PAGES)) {
  router.get(`/${path}`, async (_req, res) => {
    const products = await Product.find({ category: config.category, active: { $ne: false } }).sort({ name: 1 });
    render(res, "_collection", {
      title: config.title,
      tag: config.tag,
      heading: config.heading,
      description: config.description,
      category: config.category,
      categoryLabel: config.category,
      path,
      products,
      heroUrl: `/images/${config.heroImage}`,
    });
  });
}

router.get("/product/:slug", async (req, res) => {
  const product = await Product.findOne({ slug: req.params.slug });
  if (!product) return res.status(404).send("Product not found");

  const related = await Product.find({
    category: product.category,
    _id: { $ne: product._id },
    active: { $ne: false },
  })
    .sort({ createdAt: -1 })
    .limit(4)
    .lean();

  let relatedProducts = related;
  if (relatedProducts.length < 4) {
    const extra = await Product.find({
      _id: { $nin: [product._id, ...relatedProducts.map((r) => r._id)] },
      active: { $ne: false },
    })
      .sort({ createdAt: -1 })
      .limit(4 - relatedProducts.length)
      .lean();
    relatedProducts = [...relatedProducts, ...extra];
  }

  const collectionPath =
    Object.entries(COLLECTION_PAGES).find(([, c]) => c.category === product.category)?.[0] ??
    "search";

  render(res, "_product", {
    productId: product._id.toString(),
    slug: product.slug,
    title: product.name,
    price: product.price,
    priceFormatted: `₹${product.price.toLocaleString("en-IN")}`,
    description: `${product.name} from our ${product.category} collection — premium fabric, tailored fit, and timeless design.`,
    imagePath: product.image.replace("/images/", ""),
    image: product.image,
    categorySlug: product.category.toLowerCase().replace(/\s+/g, "-"),
    categoryLabel: product.category,
    collectionPath,
    related: relatedProducts,
  });
});

export default router;
