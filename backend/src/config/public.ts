/** Public backend URL used by the frontend for API calls. Empty = same origin. */
export function getApiUrl(): string {
  return (process.env.API_URL || "").replace(/\/$/, "");
}

/** Google OAuth client ID (public — safe in frontend/.env). */
export function getGoogleClientId(): string {
  return process.env.GOOGLE_CLIENT_ID?.trim() || "";
}

/** Site URL for emails, Stripe redirects, OAuth success pages. */
export function getAppUrl(): string {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

/** Backend URL for OAuth callbacks and webhooks (defaults to APP_URL). */
export function getBackendUrl(): string {
  return getApiUrl() || getAppUrl();
}

/** Public config injected into every page. */
export function getPublicConfig() {
  const googleClientId = getGoogleClientId();
  return {
    apiUrl: getApiUrl(),
    googleClientId,
    googleEnabled: Boolean(googleClientId && process.env.GOOGLE_CLIENT_SECRET?.trim()),
  };
}
