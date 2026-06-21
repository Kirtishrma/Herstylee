import Groq from "groq-sdk";
import { IProduct } from "../models/Product";

export interface AiDressResult {
  message: string;
  products: Array<{
    id: string;
    name: string;
    category: string;
    image: string;
    price: number;
    slug: string;
    reason: string;
  }>;
  outfitBundle?: boolean;
  outfitName?: string;
}

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

function getGroq(): Groq {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("GROQ_API_KEY is not set. Add it to your .env file.");
  }
  return new Groq({ apiKey });
}

export async function chatWithStylist(
  userMessage: string,
  products: IProduct[],
  history: ChatTurn[] = []
): Promise<AiDressResult> {
  const catalog = products.map((p) => ({
    id: p._id.toString(),
    name: p.name,
    category: p.category,
    price: p.price,
    tags: p.tags,
  }));

  const groq = getGroq();

  const systemPrompt = `You are Style Muse — HERSTYLE's personal women's fashion guide for a premium fashion store.
You are in an ongoing conversation. Remember what the user asked before and handle follow-ups naturally.
Examples of follow-ups: "show something cheaper", "in blue instead", "more traditional", "under 5000 rupees", "not that one — something simpler".

Rules:
- Reply in clear, friendly English (user may write in Hindi/Hinglish — understand it).
- Pick 1-3 BEST matching products from the catalog ONLY for simple searches. Never invent products.
- For "complete the look", "full outfit", or occasion requests (wedding, office, party, date night), pick 2-4 complementary items that work together as a coordinated outfit.
- If user refines a previous request, adjust picks accordingly — don't repeat wrong items.
- Respect budget hints (prices are in INR ₹).
- If user asks a general fashion question without needing products, still return picks: [] and answer in message.

Return JSON:
{
  "message": "Your reply (2-4 sentences)",
  "outfitBundle": true or false,
  "outfitName": "Short outfit title e.g. Wedding Evening Look (only when outfitBundle is true)",
  "picks": [
    { "id": "product_id_from_catalog", "reason": "Why this matches (1 sentence)" }
  ]
}`;

  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: systemPrompt },
    ...history.map((h) => ({ role: h.role, content: h.content })),
    {
      role: "user",
      content: `Catalog:\n${JSON.stringify(catalog)}\n\nUser message: ${userMessage}`,
    },
  ];

  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    temperature: 0.45,
    response_format: { type: "json_object" },
    messages,
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";
  let parsed: {
    message?: string;
    picks?: Array<{ id: string; reason: string }>;
    outfitBundle?: boolean;
    outfitName?: string;
  };

  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("AI returned invalid response. Try again.");
  }

  const productMap = new Map(products.map((p) => [p._id.toString(), p]));
  const matched = (parsed.picks ?? [])
    .map((pick) => {
      const product = productMap.get(pick.id);
      if (!product) return null;
      return {
        id: product._id.toString(),
        name: product.name,
        category: product.category,
        image: product.image,
        price: product.price,
        slug: product.slug,
        reason: pick.reason,
      };
    })
    .filter(Boolean) as AiDressResult["products"];

  if (matched.length === 0 && !(parsed.picks ?? []).length) {
    return {
      message: parsed.message ?? "Happy to help! What occasion are you shopping for?",
      products: [],
      outfitBundle: false,
    };
  }

  if (matched.length === 0) {
    return fallbackSearch(userMessage, products, parsed.message);
  }

  const outfitBundle = Boolean(parsed.outfitBundle) || matched.length >= 2;

  return {
    message: parsed.message ?? "Here are the best matches for you!",
    products: matched,
    outfitBundle,
    outfitName: parsed.outfitName || (outfitBundle ? "Your curated look" : undefined),
  };
}

/** @deprecated Use chatWithStylist — kept for compatibility */
export async function findDressesWithAI(
  userQuery: string,
  products: IProduct[]
): Promise<AiDressResult> {
  return chatWithStylist(userQuery, products, []);
}

function fallbackSearch(
  userQuery: string,
  products: IProduct[],
  aiMessage?: string
): AiDressResult {
  const terms = userQuery.toLowerCase().split(/\s+/).filter((t) => t.length > 2);

  const scored = products
    .map((p) => {
      const haystack = [p.name, p.category, ...p.tags].join(" ").toLowerCase();
      const score = terms.reduce((acc, term) => (haystack.includes(term) ? acc + 1 : acc), 0);
      return { product: p, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  if (scored.length === 0) {
    const random = products.slice(0, 3);
    return {
      message: aiMessage ?? "No exact match found — here are some trending picks you might like!",
      products: random.map((p) => ({
        id: p._id.toString(),
        name: p.name,
        category: p.category,
        image: p.image,
        price: p.price,
        slug: p.slug,
        reason: "Popular choice from our collection",
      })),
    };
  }

  return {
    message: aiMessage ?? "Based on your search, these dresses are the best matches!",
    products: scored.map(({ product: p }) => ({
      id: p._id.toString(),
      name: p.name,
      category: p.category,
      image: p.image,
      price: p.price,
      slug: p.slug,
      reason: "Matches your search keywords",
    })),
  };
}
