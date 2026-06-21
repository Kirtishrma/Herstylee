import { Types } from "mongoose";
import { Coupon, ICoupon } from "../models/Coupon";

export interface CouponResult {
  coupon: ICoupon;
  discount: number;
  total: number;
  subtotal: number;
}

export async function validateCoupon(
  code: string,
  subtotal: number
): Promise<{ ok: true; data: CouponResult } | { ok: false; error: string }> {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return { ok: false, error: "Enter a coupon code" };

  const coupon = await Coupon.findOne({ code: normalized });
  if (!coupon || !coupon.active) return { ok: false, error: "Invalid or inactive coupon" };

  if (coupon.expiresAt && coupon.expiresAt < new Date()) {
    return { ok: false, error: "This coupon has expired" };
  }

  if (coupon.maxUses != null && coupon.usedCount >= coupon.maxUses) {
    return { ok: false, error: "Coupon usage limit reached" };
  }

  if (subtotal < coupon.minOrder) {
    return {
      ok: false,
      error: `Minimum order ₹${coupon.minOrder.toLocaleString("en-IN")} required`,
    };
  }

  let discount =
    coupon.type === "percent"
      ? Math.round((subtotal * coupon.value) / 100)
      : Math.round(coupon.value);

  discount = Math.min(Math.max(discount, 0), subtotal);

  return {
    ok: true,
    data: {
      coupon,
      discount,
      subtotal,
      total: subtotal - discount,
    },
  };
}

export async function incrementCouponUsage(couponId: Types.ObjectId | string | undefined) {
  if (!couponId) return;
  await Coupon.findByIdAndUpdate(couponId, { $inc: { usedCount: 1 } });
}

export async function seedDefaultCoupons() {
  const count = await Coupon.countDocuments();
  if (count > 0) return;

  const nextYear = new Date();
  nextYear.setFullYear(nextYear.getFullYear() + 1);

  await Coupon.insertMany([
    {
      code: "HERSTYLE10",
      type: "percent",
      value: 10,
      minOrder: 1999,
      maxUses: 500,
      expiresAt: nextYear,
      description: "10% off orders above ₹1,999",
    },
    {
      code: "WELCOME500",
      type: "fixed",
      value: 500,
      minOrder: 2999,
      maxUses: 200,
      expiresAt: nextYear,
      description: "₹500 off first order above ₹2,999",
    },
    {
      code: "FLAT20",
      type: "percent",
      value: 20,
      minOrder: 4999,
      maxUses: 100,
      expiresAt: nextYear,
      description: "20% off premium orders above ₹4,999",
    },
  ]);

  console.log("Default coupons seeded (HERSTYLE10, WELCOME500, FLAT20)");
}
