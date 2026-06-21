import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import { connectDB } from "./db/mongodb";
import { seedProducts, syncProductImages, syncProductsFromCsv } from "./services/seedProducts";
import { optionalAuth } from "./middleware/auth";
import authRoutes from "./routes/auth";
import apiRoutes from "./routes/api";
import cartRoutes from "./routes/cart";
import wishlistRoutes from "./routes/wishlist";
import orderRoutes from "./routes/orders";
import paymentRoutes, { stripeWebhookHandler } from "./routes/payments";
import shopRoutes from "./routes/shop";
import profileRoutes from "./routes/profile";
import newsletterRoutes from "./routes/newsletter";
import reviewRoutes from "./routes/reviews";
import adminRoutes from "./routes/admin";
import couponRoutes from "./routes/coupons";
import guestRoutes from "./routes/guest";
import pageRoutes from "./routes/pages";
import { ensureAdminUser } from "./services/seedAdmin";
import { seedDefaultCoupons } from "./services/coupons";
import { startAbandonedCartScheduler } from "./services/abandonedCart";
import { FRONTEND_PUBLIC, FRONTEND_VIEWS, PROJECT_ROOT } from "./utils/paths";
import { getPublicConfig } from "./config/public";
import { loadFrontendEnv } from "./config/loadFrontendEnv";
import { corsMiddleware } from "./middleware/cors";

loadFrontendEnv();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.set("view engine", "ejs");
app.set("views", FRONTEND_VIEWS);

app.use(corsMiddleware);
app.use((_req, res, next) => {
  const cfg = getPublicConfig();
  res.locals.apiUrl = cfg.apiUrl;
  res.locals.googleClientId = cfg.googleClientId;
  res.locals.googleEnabled = cfg.googleEnabled;
  next();
});

app.post(
  "/api/payments/webhook",
  express.raw({ type: "application/json" }),
  stripeWebhookHandler
);

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());
app.use(express.static(FRONTEND_PUBLIC));
app.use(optionalAuth);

app.use(authRoutes);
app.use(apiRoutes);
app.use(cartRoutes);
app.use(wishlistRoutes);
app.use(orderRoutes);
app.use(paymentRoutes);
app.use(shopRoutes);
app.use(profileRoutes);
app.use(newsletterRoutes);
app.use(reviewRoutes);
app.use(adminRoutes);
app.use(couponRoutes);
app.use(guestRoutes);
app.use(pageRoutes);

async function start() {
  await connectDB();
  await seedProducts();
  await syncProductsFromCsv();
  await syncProductImages();
  await seedDefaultCoupons();
  await ensureAdminUser();
  startAbandonedCartScheduler();

  app.listen(PORT, () => {
    console.log(`HERSTYLE running at http://localhost:${PORT}`);
  });
}

start().catch((err) => {
  console.error("Failed to start:", err.message);
  process.exit(1);
});
