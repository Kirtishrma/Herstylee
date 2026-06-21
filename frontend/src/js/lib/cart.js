import { getToken, authFetch } from "./auth.js";
import { apiUrl } from "./api.js";
import { showToast } from "./toast.js";
import { updateNavBadges } from "./badges.js";
import { addToGuestCart } from "./guestCart.js";

export async function addToCart(productId, quantity = 1, opts = {}) {
  const { silent = false, size = "M" } = opts;

  if (!getToken()) {
    addToGuestCart(productId, quantity, size);
    updateNavBadges();
    if (!silent) showToast("Added to cart!", "success");
    return { guest: true };
  }

  const res = await authFetch("/api/cart", {
    method: "POST",
    body: JSON.stringify({ productId, quantity, size }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to add");
  updateNavBadges();
  if (!silent) showToast("Added to cart!", "success");
  return data;
}

export async function toggleWishlist(productId, opts = {}) {
  const { silent = false } = opts;
  const res = await authFetch("/api/wishlist/toggle", {
    method: "POST",
    body: JSON.stringify({ productId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed");
  updateNavBadges();
  if (!silent) {
    showToast(data.added ? "Saved to wishlist!" : "Removed from wishlist", "success");
  }
  return data;
}

export async function subscribeNewsletter(email, source = "home") {
  const res = await fetch(apiUrl("/api/newsletter/subscribe"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, source }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Subscribe failed");
  return data;
}
