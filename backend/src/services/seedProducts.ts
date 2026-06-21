import fs from "fs";
import path from "path";
import { Product } from "../models/Product";
import { imageFileExists, normalizeImagePath, toPublicImageUrl } from "../utils/imagePaths";
import { PRODUCT_CSV } from "../utils/paths";

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

function slugify(name: string, collection: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const col = collection.toLowerCase().replace(/\s+/g, "-");
  return `${col}-${base}`;
}

function parsePrice(name: string, collection: string): number {
  const base: Record<string, number> = {
    Formal: 2899,
    Casual: 1999,
    "Night Wear": 2199,
    Summer: 1799,
    Spring: 2099,
    Partywear: 3499,
    Traditional: 4999,
    Winter: 2599,
  };
  return base[collection] ?? 1999 + (name.length % 5) * 200;
}

interface CsvProduct {
  name: string;
  category: string;
  image: string;
  slug: string;
  price: number;
  tags: string[];
}

function parseCsvProducts(): CsvProduct[] {
  const csvPath = PRODUCT_CSV;
  const lines = fs.readFileSync(csvPath, "utf-8").trim().split("\n");

  const docs: CsvProduct[] = [];

  for (const line of lines.slice(1)) {
    if (!line.trim() || line.startsWith("recommendation,")) continue;

    const parts = line.split(",").map((p) => p.trim());
    if (parts.length < 3) continue;

    const [name, collection, imagePath] = parts;
    if (!name || !collection || !imagePath) continue;

    if (!imageFileExists(imagePath)) {
      console.warn(`Skipping product (image missing): ${name} → ${imagePath}`);
      continue;
    }

    const tags = [
      name.toLowerCase(),
      collection.toLowerCase(),
      ...(COLLECTION_TAGS[collection] ?? []),
    ];

    docs.push({
      name,
      category: collection,
      image: toPublicImageUrl(imagePath),
      slug: slugify(name, collection),
      price: parsePrice(name, collection),
      tags: [...new Set(tags)],
    });
  }

  return docs;
}

export async function seedProducts(): Promise<void> {
  const docs = parseCsvProducts();
  if (docs.length === 0) return;

  const count = await Product.countDocuments();
  if (count > 0) return;

  await Product.insertMany(docs);
  console.log(`Seeded ${docs.length} products`);
}

/** Upsert products from CSV and drop entries whose images no longer exist */
export async function syncProductsFromCsv(): Promise<void> {
  const docs = parseCsvProducts();
  const validSlugs = new Set<string>();
  let upserted = 0;

  for (const doc of docs) {
    validSlugs.add(doc.slug);
    const result = await Product.findOneAndUpdate({ slug: doc.slug }, doc, {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    });
    if (result) upserted += 1;
  }

  const removed = await Product.deleteMany({ slug: { $nin: [...validSlugs] } });

  if (upserted > 0 || removed.deletedCount > 0) {
    console.log(`Synced ${docs.length} products (${removed.deletedCount} removed)`);
  }
}

/** Fix image paths in MongoDB when CSV or files were corrected */
export async function syncProductImages(): Promise<void> {
  const products = await Product.find();
  let updated = 0;

  for (const product of products) {
    const raw = product.image.replace(/^\/images\//, "");
    const fixed = normalizeImagePath(raw);
    const newUrl = `/images/${fixed}`;

    if (!imageFileExists(fixed)) {
      await Product.deleteOne({ _id: product._id });
      updated += 1;
      continue;
    }

    if (product.image !== newUrl) {
      product.image = newUrl;
      await product.save();
      updated += 1;
    }
  }

  if (updated > 0) {
    console.log(`Fixed ${updated} product image paths`);
  }
}
