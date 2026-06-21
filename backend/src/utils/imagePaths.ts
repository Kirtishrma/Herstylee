import fs from "fs";
import path from "path";
import { IMAGES_ROOT } from "./paths";

export { IMAGES_ROOT };

/** Canonical formal product images (folder is `formals`, not `formal`) */
export const FORMAL_PRODUCT_IMAGES: Record<number, string> = {
  1: "formals/f1.png",
  2: "formals/f2.jpg",
  3: "formals/f3.png",
  4: "formals/f4.png",
  5: "formals/f5.jpg",
  6: "formals/f6.jpg",
  7: "formals/f7.png",
  8: "formals/f8.png",
  9: "formals/f9.png",
};

/** Canonical casual product images */
export const CASUAL_PRODUCT_IMAGES: Record<number, string> = {
  1: "casual/c1.jpg",
  2: "casual/c2.png",
  3: "casual/c3.png",
  4: "casual/c4.png",
  5: "casual/c5.png",
  6: "casual/c6.png",
  7: "casual/c7.jpg",
  8: "casual/c8.jpg",
  9: "casual/c9.jpg",
};

const PATH_ALIASES: Record<string, string> = {
  "formal/f1.jpg": FORMAL_PRODUCT_IMAGES[1],
  "formal/f2.jpg": FORMAL_PRODUCT_IMAGES[2],
  "formal/f3.jpg": FORMAL_PRODUCT_IMAGES[3],
  "formal/f4.jpg": FORMAL_PRODUCT_IMAGES[4],
  "formal/f5.jpg": FORMAL_PRODUCT_IMAGES[5],
  "formal/f6.jpg": FORMAL_PRODUCT_IMAGES[6],
  "formal/f7.jpg": FORMAL_PRODUCT_IMAGES[7],
  "formal/f8.jpg": FORMAL_PRODUCT_IMAGES[8],
  "formal/f9.jpg": FORMAL_PRODUCT_IMAGES[9],
  "casual/c2.jpg": CASUAL_PRODUCT_IMAGES[2],
  "casual/c3.jpg": CASUAL_PRODUCT_IMAGES[3],
  "casual/c4.jpg": CASUAL_PRODUCT_IMAGES[4],
  "casual/c5.jpg": CASUAL_PRODUCT_IMAGES[5],
  "casual/c6.jpg": CASUAL_PRODUCT_IMAGES[6],
  "casual/c11.png": CASUAL_PRODUCT_IMAGES[1],
};

for (let i = 1; i <= 9; i++) {
  PATH_ALIASES[`formals/f${i}/front.png`] = FORMAL_PRODUCT_IMAGES[i];
}

/** Fix CSV / DB image paths to match files on disk */
export function normalizeImagePath(rawPath: string): string {
  let p = rawPath.replace(/^\/+/, "").replace(/^images\//, "");

  if (PATH_ALIASES[p]) return PATH_ALIASES[p];

  if (p.startsWith("formal/")) {
    p = p.replace(/^formal\//, "formals/");
  }

  if (/^w\d+\.jpg$/i.test(p)) {
    p = `winter/${p}`;
  }

  const full = path.join(IMAGES_ROOT, p);
  if (fs.existsSync(full)) return p;

  const alt = p.endsWith(".jpg")
    ? p.replace(/\.jpg$/, ".png")
    : p.replace(/\.png$/, ".jpg");
  if (fs.existsSync(path.join(IMAGES_ROOT, alt))) return alt;

  return p;
}

export function imageFileExists(relativePath: string): boolean {
  const normalized = normalizeImagePath(relativePath);
  return fs.existsSync(path.join(IMAGES_ROOT, normalized));
}

export function toPublicImageUrl(relativePath: string): string {
  return `/images/${normalizeImagePath(relativePath)}`;
}
