import { apiUrl } from "./api.js";

const GUEST_CART_KEY = "herstyle_guest_cart";

export function getGuestCart() {
  try {
    return JSON.parse(localStorage.getItem(GUEST_CART_KEY) || "[]");
  } catch {
    return [];
  }
}

export function saveGuestCart(items) {
  localStorage.setItem(GUEST_CART_KEY, JSON.stringify(items));
}

export function getGuestCartCount() {
  return getGuestCart().reduce((sum, item) => sum + (item.quantity || 1), 0);
}

export function addToGuestCart(productId, quantity = 1, size = "M") {
  const items = getGuestCart();
  const existing = items.find((i) => i.productId === productId && (i.size || "M") === size);
  if (existing) {
    existing.quantity += quantity;
  } else {
    items.push({ productId, quantity, size });
  }
  saveGuestCart(items);
  return items;
}

export function updateGuestCartQty(productId, size, quantity) {
  const items = getGuestCart();
  const item = items.find((i) => i.productId === productId && (i.size || "M") === size);
  if (!item) return items;
  if (quantity <= 0) {
    return removeFromGuestCart(productId, size);
  }
  item.quantity = quantity;
  saveGuestCart(items);
  return items;
}

export function removeFromGuestCart(productId, size = "M") {
  const items = getGuestCart().filter(
    (i) => !(i.productId === productId && (i.size || "M") === size)
  );
  saveGuestCart(items);
  return items;
}

export function clearGuestCart() {
  localStorage.removeItem(GUEST_CART_KEY);
}

export async function fetchGuestCartSummary() {
  const items = getGuestCart();
  if (!items.length) return { items: [], total: 0, count: 0 };

  const res = await fetch(apiUrl("/api/guest/cart/summary"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Could not load cart");
  return data;
}

export async function guestPaymentPreview(couponCode) {
  const items = getGuestCart();
  const res = await fetch(apiUrl("/api/guest/payments/preview"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items, coupon: couponCode || "" }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Preview failed");
  return data;
}
