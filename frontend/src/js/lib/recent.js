import { RECENT_KEY, RECENT_MAX } from "./constants.js";
import { getToken, authFetch } from "./auth.js";
import { apiUrl } from "./api.js";

export function trackRecentlyViewed(product) {
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
    category: product.category,
  });
  recent = recent.slice(0, RECENT_MAX);
  localStorage.setItem(RECENT_KEY, JSON.stringify(recent));
}

export function getRecentSlugs() {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]").map((p) => p.slug);
  } catch {
    return [];
  }
}

function renderHomeProductCard(p, { badge = "", showBuyAgain = false } = {}) {
  const buyAgain = showBuyAgain
    ? `<div class="catalog-card-actions">
        <button type="button" class="btn-sm btn-dark" onclick="addToCart('${p.id || p._id}', 1)">Buy Again</button>
        <a href="/product/${p.slug}" class="btn-sm btn-outline">View</a>
      </div>`
    : "";

  return `
    <div class="catalog-card group">
      <a href="/product/${p.slug}" class="catalog-img-wrap overflow-hidden">
        ${badge ? `<span class="home-product-badge">${badge}</span>` : ""}
        <img src="${p.image}" alt="${p.name}" loading="lazy" class="transition-transform duration-300 group-hover:scale-105">
      </a>
      <div class="catalog-info">
        <span class="catalog-cat">${p.category}</span>
        <h3><a href="/product/${p.slug}">${p.name}</a></h3>
        <p class="catalog-price">₹${p.price.toLocaleString("en-IN")}</p>
        ${buyAgain}
      </div>
    </div>`;
}

export async function loadRecentlyViewed() {
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

export async function loadPreviouslyPurchased() {
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

    grid.innerHTML = products
      .map((p) => renderHomeProductCard(p, { badge: "Purchased", showBuyAgain: true }))
      .join("");
  } catch {
    section.hidden = true;
  }
}

export function skeletonGridHtml(count = 4) {
  return Array.from({ length: count })
    .map(
      () => `
    <div class="skeleton-card animate-pulse rounded-2xl border border-gray-100 bg-white p-3">
      <div class="skeleton skeleton-img mb-3 aspect-[3/4] rounded-xl bg-gray-200"></div>
      <div class="skeleton skeleton-line mb-2 h-4 rounded bg-gray-200"></div>
      <div class="skeleton skeleton-line short h-3 w-2/3 rounded bg-gray-100"></div>
    </div>`
    )
    .join("");
}

export function skeletonCartHtml() {
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
