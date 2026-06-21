import { Router } from "express";
import { Product } from "../models/Product";
import { ChatHistory } from "../models/ChatHistory";
import { ChatSession } from "../models/ChatSession";
import { chatWithStylist } from "../services/groq";
import { requireAuth, AuthRequest } from "../middleware/auth";

const router = Router();

router.post("/api/ai/chat", requireAuth, async (req: AuthRequest, res) => {
  try {
    const message = String(req.body.message ?? "").trim();
    const sessionId = req.body.sessionId ? String(req.body.sessionId) : undefined;

    if (!message) {
      return res.status(400).json({ error: "Please type a message for Style Muse." });
    }

    let session = sessionId
      ? await ChatSession.findOne({ _id: sessionId, user: req.user!.id })
      : null;

    if (!session) {
      session = await ChatSession.create({
        user: req.user!.id,
        title: message.slice(0, 80),
        messages: [],
      });
    }

    const history = session.messages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    const products = await Product.find().lean();
    const result = await chatWithStylist(message, products as never, history);

    session.messages.push({ role: "user", content: message });
    session.messages.push({
      role: "assistant",
      content: result.message,
      products: result.products.map((p) => ({
        productId: p.id,
        name: p.name,
        slug: p.slug,
        image: p.image,
        price: p.price,
        reason: p.reason,
      })),
    });
    await session.save();

    await ChatHistory.create({
      user: req.user!.id,
      query: message,
      message: result.message,
      products: result.products.map((p) => ({
        productId: p.id,
        name: p.name,
        slug: p.slug,
        image: p.image,
        price: p.price,
        reason: p.reason,
      })),
    });

    return res.json({
      sessionId: session._id.toString(),
      message: result.message,
      products: result.products,
      outfitBundle: result.outfitBundle ?? false,
      outfitName: result.outfitName ?? null,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "AI chat failed";
    return res.status(500).json({ error: msg });
  }
});

router.get("/api/ai/sessions", requireAuth, async (req: AuthRequest, res) => {
  const sessions = await ChatSession.find({ user: req.user!.id })
    .sort({ updatedAt: -1 })
    .limit(15)
    .select("title updatedAt messages")
    .lean();

  res.json(
    sessions.map((s) => ({
      id: s._id.toString(),
      title: s.title,
      preview: s.messages[s.messages.length - 1]?.content?.slice(0, 100) ?? "",
      messageCount: s.messages.length,
      updatedAt: s.updatedAt,
    }))
  );
});

router.get("/api/ai/sessions/:id", requireAuth, async (req: AuthRequest, res) => {
  const session = await ChatSession.findOne({ _id: req.params.id, user: req.user!.id }).lean();
  if (!session) return res.status(404).json({ error: "Session not found" });

  res.json({
    id: session._id.toString(),
    title: session.title,
    messages: session.messages,
    updatedAt: session.updatedAt,
  });
});

router.post("/api/ai/find-dress", requireAuth, async (req: AuthRequest, res) => {
  try {
    const query = String(req.body.query ?? req.body.message ?? "").trim();
    if (!query) {
      return res.status(400).json({ error: "Please describe what kind of dress you're looking for." });
    }

    const products = await Product.find().lean();
    const result = await chatWithStylist(query, products as never, []);

    await ChatHistory.create({
      user: req.user!.id,
      query,
      message: result.message,
      products: result.products.map((p) => ({
        productId: p.id,
        name: p.name,
        slug: p.slug,
        image: p.image,
        price: p.price,
        reason: p.reason,
      })),
    });

    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI search failed";
    return res.status(500).json({ error: message });
  }
});

router.get("/api/ai/history", requireAuth, async (req: AuthRequest, res) => {
  const history = await ChatHistory.find({ user: req.user!.id })
    .sort({ createdAt: -1 })
    .limit(20)
    .lean();

  res.json(
    history.map((h) => ({
      id: h._id.toString(),
      query: h.query,
      message: h.message,
      products: h.products,
      createdAt: h.createdAt,
    }))
  );
});

router.get("/api/products", async (req, res) => {
  const category = req.query.category ? String(req.query.category) : undefined;
  const q = String(req.query.q ?? "").trim();
  const minPrice = Number(req.query.minPrice) || 0;
  const maxPrice = Number(req.query.maxPrice) || 999999;

  const filter: Record<string, unknown> = {
    price: { $gte: minPrice, $lte: maxPrice },
  };

  if (category) filter.category = category;
  if (q) {
    filter.$or = [
      { name: { $regex: q, $options: "i" } },
      { category: { $regex: q, $options: "i" } },
      { tags: { $regex: q, $options: "i" } },
    ];
  }

  const products = await Product.find(filter)
    .select("name category image price slug tags")
    .sort({ price: 1 })
    .lean();

  res.json(products);
});

router.get("/api/products/categories", async (_req, res) => {
  const categories = await Product.distinct("category");
  res.json(categories);
});

router.get("/api/products/by-slugs", async (req, res) => {
  const slugs = String(req.query.slugs ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 8);

  if (!slugs.length) return res.json([]);

  const products = await Product.find({ slug: { $in: slugs } })
    .select("name category image price slug")
    .lean();

  const order = new Map(slugs.map((s, i) => [s, i]));
  products.sort((a, b) => (order.get(a.slug) ?? 99) - (order.get(b.slug) ?? 99));

  res.json(products);
});

export default router;
