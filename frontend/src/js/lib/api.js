/** Backend base URL — empty means same origin (monolith deploy). */
export function getApiBase() {
  if (typeof window !== "undefined" && window.__API_URL__) {
    return String(window.__API_URL__).replace(/\/$/, "");
  }
  return "";
}

/** Prefix a path with the configured backend URL. */
export function apiUrl(path) {
  const p = path.startsWith("/") ? path : `/${path}`;
  const base = getApiBase();
  return base ? `${base}${p}` : p;
}
