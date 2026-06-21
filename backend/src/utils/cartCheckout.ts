import { Types } from "mongoose";
import { Cart } from "../models/Cart";
import { Product } from "../models/Product";

export interface CheckoutLineItem {
  product: Types.ObjectId;
  name: string;
  slug: string;
  image: string;
  price: number;
  quantity: number;
  size: string;
}

export interface CartCheckoutData {
  orderItems: CheckoutLineItem[];
  totalInr: number;
}

type PopulatedProduct = {
  _id: { toString(): string };
  name: string;
  slug: string;
  image: string;
  price: number;
} | null;

export async function buildCartCheckout(userId: string): Promise<CartCheckoutData | null> {
  const cart = await Cart.findOne({ user: userId }).populate("items.product");
  if (!cart || cart.items.length === 0) return null;

  const orderItems: CheckoutLineItem[] = [];
  let totalInr = 0;

  for (const item of cart.items) {
    const p = item.product as unknown as PopulatedProduct;
    if (!p) continue;

    totalInr += p.price * item.quantity;
    orderItems.push({
      product: p._id as unknown as Types.ObjectId,
      name: p.name,
      slug: p.slug,
      image: p.image,
      price: p.price,
      quantity: item.quantity,
      size: item.size || "M",
    });
  }

  if (orderItems.length === 0) return null;
  return { orderItems, totalInr };
}

export async function buildGuestCartCheckout(
  items: { productId: string; quantity: number; size?: string }[]
): Promise<CartCheckoutData | null> {
  if (!items.length) return null;

  const orderItems: CheckoutLineItem[] = [];
  let totalInr = 0;

  for (const item of items) {
    const product = await Product.findById(item.productId);
    if (!product || product.active === false) continue;

    const quantity = Math.max(1, Number(item.quantity) || 1);
    totalInr += product.price * quantity;
    orderItems.push({
      product: product._id,
      name: product.name,
      slug: product.slug,
      image: product.image,
      price: product.price,
      quantity,
      size: item.size || "M",
    });
  }

  if (orderItems.length === 0) return null;
  return { orderItems, totalInr };
}

export async function clearUserCart(userId: string): Promise<void> {
  const cart = await Cart.findOne({ user: userId });
  if (!cart) return;
  cart.items = [];
  await cart.save();
}
