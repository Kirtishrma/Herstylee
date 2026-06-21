export const PRODUCT_SIZES = ["XS", "S", "M", "L", "XL"] as const;
export type ProductSize = (typeof PRODUCT_SIZES)[number];

export function normalizeSize(size: unknown): ProductSize {
  const s = String(size ?? "M").toUpperCase();
  return (PRODUCT_SIZES as readonly string[]).includes(s) ? (s as ProductSize) : "M";
}
