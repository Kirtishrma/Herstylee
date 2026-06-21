import { TOKEN_KEY } from "./constants.js";
import { apiUrl } from "./api.js";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function authHeaders(extra = {}) {
  const token = getToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

export async function authFetch(url, options = {}) {
  const res = await fetch(apiUrl(url), {
    credentials: "include",
    ...options,
    headers: { ...authHeaders(), ...(options.headers || {}) },
  });
  if (res.status === 401) {
    localStorage.removeItem(TOKEN_KEY);
    window.location.href = "/login";
    throw new Error("Login required");
  }
  return res;
}
