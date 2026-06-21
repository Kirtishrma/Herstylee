import { OAuth2Client } from "google-auth-library";

import { getBackendUrl } from "../config/public";

export interface GoogleProfile {
  googleId: string;
  email: string;
  fullname: string;
  avatar?: string;
}

function getRedirectUri(): string {
  return `${getBackendUrl()}/auth/google/callback`;
}

export function isGoogleAuthConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim());
}

export function getGoogleClient(): OAuth2Client {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth is not configured. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env");
  }
  return new OAuth2Client(clientId, clientSecret, getRedirectUri());
}

export function getGoogleAuthUrl(): string {
  const client = getGoogleClient();
  return client.generateAuthUrl({
    access_type: "online",
    scope: ["openid", "email", "profile"],
    prompt: "select_account",
    include_granted_scopes: true,
  });
}

export async function fetchGoogleProfile(code: string): Promise<GoogleProfile> {
  const client = getGoogleClient();
  const { tokens } = await client.getToken(code);
  if (!tokens.access_token) throw new Error("Google did not return an access token");

  const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });

  if (!res.ok) throw new Error("Could not fetch Google profile");

  const data = (await res.json()) as {
    id?: string;
    email?: string;
    name?: string;
    picture?: string;
    verified_email?: boolean;
  };

  if (!data.id || !data.email) {
    throw new Error("Google account missing email or id");
  }

  return {
    googleId: data.id,
    email: data.email.toLowerCase(),
    fullname: data.name || data.email.split("@")[0],
    avatar: data.picture,
  };
}
