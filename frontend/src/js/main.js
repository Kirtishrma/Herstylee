import { TOKEN_KEY } from "./lib/constants.js";
import { apiUrl } from "./lib/api.js";
import { getToken, authHeaders, authFetch } from "./lib/auth.js";
import { showToast, ensureToastRoot } from "./lib/toast.js";
import { addToCart, toggleWishlist, subscribeNewsletter } from "./lib/cart.js";
import { updateNavBadges } from "./lib/badges.js";
import {
  getGuestCart,
  clearGuestCart,
  fetchGuestCartSummary,
  guestPaymentPreview,
  removeFromGuestCart,
  updateGuestCartQty,
} from "./lib/guestCart.js";
import {
  trackRecentlyViewed,
  getRecentSlugs,
  loadRecentlyViewed,
  loadPreviouslyPurchased,
  skeletonCartHtml,
  skeletonGridHtml,
} from "./lib/recent.js";

/** Global API for EJS inline scripts & legacy pages */
Object.assign(window, {
  TOKEN_KEY,
  apiUrl,
  getToken,
  authHeaders,
  authFetch,
  showToast,
  ensureToastRoot,
  addToCart,
  toggleWishlist,
  subscribeNewsletter,
  updateNavBadges,
  trackRecentlyViewed,
  getRecentSlugs,
  loadRecentlyViewed,
  loadPreviouslyPurchased,
  skeletonCartHtml,
  skeletonGridHtml,
  getGuestCart,
  clearGuestCart,
  fetchGuestCartSummary,
  guestPaymentPreview,
  removeFromGuestCart,
  updateGuestCartQty,
});

document.addEventListener("DOMContentLoaded", () => {
  ensureToastRoot();
  updateNavBadges();

  const newsletterForm = document.getElementById("newsletterForm");
  if (newsletterForm) {
    newsletterForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const input = newsletterForm.querySelector('input[type="email"]');
      const btn = newsletterForm.querySelector('button[type="submit"]');
      const email = input?.value?.trim();
      if (!email) {
        showToast("Please enter your email.", "error");
        return;
      }
      const label = btn.textContent;
      btn.disabled = true;
      btn.textContent = "Subscribing...";
      try {
        const data = await subscribeNewsletter(email);
        showToast(data.message, "success");
        input.value = "";
      } catch (err) {
        showToast(err.message || "Could not subscribe.", "error");
      } finally {
        btn.disabled = false;
        btn.textContent = label;
      }
    });
  }

  loadRecentlyViewed();
  loadPreviouslyPurchased();
});
