import path from "path";

/** backend/ — paths.ts lives in src/utils/ or dist/utils/ */
export const BACKEND_ROOT = path.join(__dirname, "..", "..");

/** Project root (parent of backend/) */
export const PROJECT_ROOT = path.join(BACKEND_ROOT, "..");

export const FRONTEND_VIEWS = path.join(PROJECT_ROOT, "frontend", "views");
export const FRONTEND_PUBLIC = path.join(PROJECT_ROOT, "frontend", "public");
export const PRODUCT_CSV = path.join(BACKEND_ROOT, "data", "fashion_products.csv");
export const IMAGES_ROOT = path.join(FRONTEND_PUBLIC, "images");
