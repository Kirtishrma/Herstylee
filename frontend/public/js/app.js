var Herstyle = (() => {
  // src/js/lib/constants.js
  var TOKEN_KEY = "herstyle_jwt";
  var RECENT_KEY = "herstyle_recent";
  var RECENT_MAX = 8;

  // src/js/lib/api.js
  function getApiBase() {
    if (typeof window !== "undefined" && window.__API_URL__) {
      return String(window.__API_URL__).replace(/\/$/, "");
    }
    return "";
  }
  function apiUrl(path) {
    const p = path.startsWith("/") ? path : `/${path}`;
    const base = getApiBase();
    return base ? `${base}${p}` : p;
  }

  // src/js/lib/auth.js
  function getToken() {
    return localStorage.getItem(TOKEN_KEY);
  }
  function authHeaders(extra = {}) {
    const token = getToken();
    return {
      "Content-Type": "application/json",
      ...token ? { Authorization: `Bearer ${token}` } : {},
      ...extra
    };
  }
  async function authFetch(url, options = {}) {
    const res = await fetch(apiUrl(url), {
      credentials: "include",
      ...options,
      headers: { ...authHeaders(), ...options.headers || {} }
    });
    if (res.status === 401) {
      localStorage.removeItem(TOKEN_KEY);
      window.location.href = "/login";
      throw new Error("Login required");
    }
    return res;
  }

  // src/js/lib/toast.js
  function ensureToastRoot() {
    if (document.getElementById("toast-root")) return;
    const root = document.createElement("div");
    root.id = "toast-root";
    root.className = "fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none [&>*]:pointer-events-auto";
    root.setAttribute("aria-live", "polite");
    document.body.appendChild(root);
  }
  function showToast(message, type = "success", duration = 3500) {
    ensureToastRoot();
    const root = document.getElementById("toast-root");
    const colors = {
      success: "border-green-200 bg-green-50 text-green-800",
      error: "border-red-200 bg-red-50 text-red-800",
      info: "border-blue-200 bg-blue-50 text-blue-800"
    };
    const icons = { success: "\u2713", error: "!", info: "i" };
    const toast = document.createElement("div");
    toast.className = `flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium shadow-lg transition-all duration-300 translate-y-2 opacity-0 ${colors[type] || colors.info}`;
    toast.innerHTML = `
    <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/80 text-xs font-bold">${icons[type] || icons.info}</span>
    <span class="flex-1">${message}</span>
    <button type="button" class="ml-1 text-lg leading-none opacity-60 hover:opacity-100" aria-label="Dismiss">\xD7</button>
  `;
    const remove = () => {
      toast.classList.add("translate-y-2", "opacity-0");
      setTimeout(() => toast.remove(), 280);
    };
    toast.querySelector("button").onclick = remove;
    root.appendChild(toast);
    requestAnimationFrame(() => toast.classList.remove("translate-y-2", "opacity-0"));
    const timer = setTimeout(remove, duration);
    toast.onmouseenter = () => clearTimeout(timer);
    toast.onmouseleave = () => setTimeout(remove, 1200);
  }

  // src/js/lib/guestCart.js
  var GUEST_CART_KEY = "herstyle_guest_cart";
  function getGuestCart() {
    try {
      return JSON.parse(localStorage.getItem(GUEST_CART_KEY) || "[]");
    } catch {
      return [];
    }
  }
  function saveGuestCart(items) {
    localStorage.setItem(GUEST_CART_KEY, JSON.stringify(items));
  }
  function getGuestCartCount() {
    return getGuestCart().reduce((sum, item) => sum + (item.quantity || 1), 0);
  }
  function addToGuestCart(productId, quantity = 1, size = "M") {
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
  function updateGuestCartQty(productId, size, quantity) {
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
  function removeFromGuestCart(productId, size = "M") {
    const items = getGuestCart().filter(
      (i) => !(i.productId === productId && (i.size || "M") === size)
    );
    saveGuestCart(items);
    return items;
  }
  function clearGuestCart() {
    localStorage.removeItem(GUEST_CART_KEY);
  }
  async function fetchGuestCartSummary() {
    const items = getGuestCart();
    if (!items.length) return { items: [], total: 0, count: 0 };
    const res = await fetch(apiUrl("/api/guest/cart/summary"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Could not load cart");
    return data;
  }
  async function guestPaymentPreview(couponCode) {
    const items = getGuestCart();
    const res = await fetch(apiUrl("/api/guest/payments/preview"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items, coupon: couponCode || "" })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Preview failed");
    return data;
  }

  // src/js/lib/badges.js
  async function updateNavBadges() {
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
        authFetch("/api/wishlist")
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
    }
  }

  // src/js/lib/cart.js
  async function addToCart(productId, quantity = 1, opts = {}) {
    const { silent = false, size = "M" } = opts;
    if (!getToken()) {
      addToGuestCart(productId, quantity, size);
      updateNavBadges();
      if (!silent) showToast("Added to cart!", "success");
      return { guest: true };
    }
    const res = await authFetch("/api/cart", {
      method: "POST",
      body: JSON.stringify({ productId, quantity, size })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to add");
    updateNavBadges();
    if (!silent) showToast("Added to cart!", "success");
    return data;
  }
  async function toggleWishlist(productId, opts = {}) {
    const { silent = false } = opts;
    const res = await authFetch("/api/wishlist/toggle", {
      method: "POST",
      body: JSON.stringify({ productId })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed");
    updateNavBadges();
    if (!silent) {
      showToast(data.added ? "Saved to wishlist!" : "Removed from wishlist", "success");
    }
    return data;
  }
  async function subscribeNewsletter(email, source = "home") {
    const res = await fetch(apiUrl("/api/newsletter/subscribe"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, source })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Subscribe failed");
    return data;
  }

  // src/js/lib/recent.js
  function trackRecentlyViewed(product) {
    if (!product?.slug) return;
    let recent = [];
    try {
      recent = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
    } catch {
      recent = [];
    }
    recent = recent.filter((p) => p.slug !== product.slug);
    recent.unshift({
      slug: product.slug,
      name: product.name,
      image: product.image,
      price: product.price,
      category: product.category
    });
    recent = recent.slice(0, RECENT_MAX);
    localStorage.setItem(RECENT_KEY, JSON.stringify(recent));
  }
  function getRecentSlugs() {
    try {
      return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]").map((p) => p.slug);
    } catch {
      return [];
    }
  }
  function renderHomeProductCard(p, { badge = "", showBuyAgain = false } = {}) {
    const buyAgain = showBuyAgain ? `<div class="catalog-card-actions">
        <button type="button" class="btn-sm btn-dark" onclick="addToCart('${p.id || p._id}', 1)">Buy Again</button>
        <a href="/product/${p.slug}" class="btn-sm btn-outline">View</a>
      </div>` : "";
    return `
    <div class="catalog-card group">
      <a href="/product/${p.slug}" class="catalog-img-wrap overflow-hidden">
        ${badge ? `<span class="home-product-badge">${badge}</span>` : ""}
        <img src="${p.image}" alt="${p.name}" loading="lazy" class="transition-transform duration-300 group-hover:scale-105">
      </a>
      <div class="catalog-info">
        <span class="catalog-cat">${p.category}</span>
        <h3><a href="/product/${p.slug}">${p.name}</a></h3>
        <p class="catalog-price">\u20B9${p.price.toLocaleString("en-IN")}</p>
        ${buyAgain}
      </div>
    </div>`;
  }
  async function loadRecentlyViewed() {
    const section = document.getElementById("recentlySection");
    const grid = document.getElementById("recentlyGrid");
    if (!section || !grid) return;
    const slugs = getRecentSlugs();
    if (!slugs.length) return;
    section.hidden = false;
    grid.innerHTML = skeletonGridHtml(Math.min(slugs.length, 4));
    try {
      const res = await fetch(apiUrl(`/api/products/by-slugs?slugs=${slugs.join(",")}`));
      const products = await res.json();
      if (!products.length) {
        section.hidden = true;
        return;
      }
      grid.innerHTML = products.map((p) => renderHomeProductCard(p)).join("");
    } catch {
      section.hidden = true;
    }
  }
  async function loadPreviouslyPurchased() {
    const section = document.getElementById("purchasedSection");
    const grid = document.getElementById("purchasedGrid");
    if (!section || !grid || !getToken()) return;
    section.hidden = false;
    grid.innerHTML = skeletonGridHtml(4);
    try {
      const res = await authFetch("/api/orders/purchased-products");
      const products = await res.json();
      if (!res.ok || !products.length) {
        section.hidden = true;
        return;
      }
      grid.innerHTML = products.map((p) => renderHomeProductCard(p, { badge: "Purchased", showBuyAgain: true })).join("");
    } catch {
      section.hidden = true;
    }
  }
  function skeletonGridHtml(count = 4) {
    return Array.from({ length: count }).map(
      () => `
    <div class="skeleton-card animate-pulse rounded-2xl border border-gray-100 bg-white p-3">
      <div class="skeleton skeleton-img mb-3 aspect-[3/4] rounded-xl bg-gray-200"></div>
      <div class="skeleton skeleton-line mb-2 h-4 rounded bg-gray-200"></div>
      <div class="skeleton skeleton-line short h-3 w-2/3 rounded bg-gray-100"></div>
    </div>`
    ).join("");
  }
  function skeletonCartHtml() {
    return `<div class="cart-layout">
    <div class="panel skeleton-cart-table animate-pulse rounded-2xl border border-gray-100 bg-white p-6">
      ${Array.from({ length: 3 }).map(() => '<div class="skeleton skeleton-row mb-4 h-16 rounded-lg bg-gray-100"></div>').join("")}
    </div>
    <div class="panel skeleton-cart-summary animate-pulse rounded-2xl border border-gray-100 bg-white p-6">
      <div class="skeleton skeleton-line mb-3 h-4 rounded bg-gray-200"></div>
      <div class="skeleton skeleton-line short mb-4 h-3 w-1/2 rounded bg-gray-100"></div>
      <div class="skeleton skeleton-btn h-11 rounded-full bg-gray-200"></div>
    </div>
  </div>`;
  }

  // src/js/main.js
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
    updateGuestCartQty
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
})();
