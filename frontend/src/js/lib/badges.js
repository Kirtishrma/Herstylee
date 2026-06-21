import { getToken, authFetch } from "./auth.js";
import { getGuestCartCount } from "./guestCart.js";

export async function updateNavBadges() {
  const token = getToken();
  const cartBadge = document.getElementById("cartBadge");
  const wishBadge = document.getElementById("wishBadge");

  if (!token) {
    const guestCount = getGuestCartCount();
    if (cartBadge) {
      cartBadge.textContent = guestCount || 0;
      cartBadge.hidden = !guestCount;
    }
    if (wishBadge) wishBadge.hidden = true;
    return;
  }

  try {
    const [cartRes, wishRes] = await Promise.all([
      authFetch("/api/cart"),
      authFetch("/api/wishlist"),
    ]);
    const cart = await cartRes.json();
    const wish = await wishRes.json();
    if (cartBadge) {
      cartBadge.textContent = cart.count || 0;
      cartBadge.hidden = !cart.count;
    }
    if (wishBadge) {
      wishBadge.textContent = wish.count || 0;
      wishBadge.hidden = !wish.count;
    }
  } catch {
    /* ignore */
  }
}
