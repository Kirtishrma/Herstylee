import { Router } from "express";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { buildCartCheckout } from "../utils/cartCheckout";
import { validateCoupon } from "../services/coupons";

const router = Router();

router.post("/api/coupons/validate", requireAuth, async (req: AuthRequest, res) => {
  const code = String(req.body.code ?? "").trim();
  const checkout = await buildCartCheckout(req.user!.id);
  if (!checkout) return res.status(400).json({ error: "Cart is empty" });

  const result = await validateCoupon(code, checkout.totalInr);
  if (!result.ok) return res.status(400).json({ error: result.error });

  res.json({
    code: result.data.coupon.code,
    type: result.data.coupon.type,
    discount: result.data.discount,
    subtotal: result.data.subtotal,
    total: result.data.total,
    description: result.data.coupon.description,
    formattedDiscount: `-₹${result.data.discount.toLocaleString("en-IN")}`,
    formattedTotal: `₹${result.data.total.toLocaleString("en-IN")}`,
  });
});

export default router;
