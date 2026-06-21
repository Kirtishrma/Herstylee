import jwt from "jsonwebtoken";
import { Response } from "express";
import { IUser } from "../models/User";

const JWT_EXPIRY = "7d";
export const COOKIE_NAME = "herstyle_token";
export const TOKEN_KEY = "herstyle_jwt";

function getSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret === "change-this-to-a-long-random-string") {
    throw new Error("Set a strong JWT_SECRET in your .env file");
  }
  return secret;
}

export interface JwtPayload {
  userId: string;
  email: string;
}

export function signToken(user: IUser): string {
  return jwt.sign(
    { userId: user._id.toString(), email: user.email } satisfies JwtPayload,
    getSecret(),
    { expiresIn: JWT_EXPIRY }
  );
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, getSecret()) as JwtPayload;
}

export function setAuthCookie(res: Response, token: string): void {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

export function clearAuthCookie(res: Response): void {
  res.clearCookie(COOKIE_NAME);
}
