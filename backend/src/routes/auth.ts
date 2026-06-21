import { Router } from "express";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { User, toPublicUser, isGoogleOnlyUser } from "../models/User";
import { clearAuthCookie, setAuthCookie, signToken } from "../utils/jwt";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { sendPasswordResetEmail, isEmailConfigured } from "../services/email";
import {
  fetchGoogleProfile,
  getGoogleAuthUrl,
  isGoogleAuthConfigured,
} from "../services/googleAuth";
import { getPostLoginPath, promoteAdminIfNeeded } from "../services/seedAdmin";
import { getPublicConfig } from "../config/public";

const router = Router();

router.get("/api/auth/config", (_req, res) => {
  const cfg = getPublicConfig();
  res.json({ googleEnabled: cfg.googleEnabled, googleClientId: cfg.googleClientId || undefined });
});

router.get("/auth/google", (_req, res) => {
  if (!isGoogleAuthConfigured()) {
    return res.redirect("/login?error=google_not_configured");
  }
  try {
    res.redirect(getGoogleAuthUrl());
  } catch {
    res.redirect("/login?error=google_failed");
  }
});

router.get("/auth/google/callback", async (req, res) => {
  const appUrl = process.env.APP_URL || "http://localhost:3000";

  if (req.query.error) {
    return res.redirect(`${appUrl}/login?error=google_denied`);
  }

  const code = String(req.query.code ?? "");
  if (!code) {
    return res.redirect(`${appUrl}/login?error=google_failed`);
  }

  try {
    const profile = await fetchGoogleProfile(code);

    let user = await User.findOne({ googleId: profile.googleId });
    if (!user) {
      user = await User.findOne({ email: profile.email });
    }

    if (user) {
      user.googleId = profile.googleId;
      user.fullname = profile.fullname || user.fullname;
      user.avatar = profile.avatar || user.avatar;
      await user.save();
    } else {
      user = await User.create({
        fullname: profile.fullname,
        email: profile.email,
        googleId: profile.googleId,
        avatar: profile.avatar,
      });
    }

    await promoteAdminIfNeeded(user);

    const token = signToken(user);
    setAuthCookie(res, token);
    const redirect = getPostLoginPath(Boolean(user.isAdmin));
    res.redirect(
      `${appUrl}/auth/google/success?token=${encodeURIComponent(token)}&redirect=${encodeURIComponent(redirect)}`
    );
  } catch (err) {
    console.error("[google-auth]", err instanceof Error ? err.message : err);
    res.redirect(`${appUrl}/login?error=google_failed`);
  }
});

router.get("/auth/google/success", (req, res) => {
  const redirect = String(req.query.redirect ?? "/profile");
  const safeRedirect = redirect.startsWith("/") && !redirect.startsWith("//") ? redirect : "/profile";
  res.render("google-success", {
    token: String(req.query.token ?? ""),
    redirect: safeRedirect,
  });
});

router.post("/api/auth/register", async (req, res) => {
  try {
    const fullname = String(req.body.fullname ?? "").trim();
    const email = String(req.body.email ?? "").trim().toLowerCase();
    const password = String(req.body.password ?? "");

    if (!fullname || !email || !password) {
      return res.status(400).json({ error: "Name, email and password required" });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      if (existing.googleId && !existing.password) {
        return res.status(409).json({ error: "This email uses Google sign-in. Continue with Google." });
      }
      return res.status(409).json({ error: "Email already registered" });
    }

    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({ fullname, email, password: hashed });
    await promoteAdminIfNeeded(user);

    const token = signToken(user);
    setAuthCookie(res, token);

    return res.json({
      token,
      user: toPublicUser(user),
      redirect: getPostLoginPath(Boolean(user.isAdmin)),
    });
  } catch {
    return res.status(500).json({ error: "Registration failed" });
  }
});

router.post("/api/auth/login", async (req, res) => {
  try {
    const email = String(req.body.email ?? "").trim().toLowerCase();
    const password = String(req.body.password ?? "");

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    if (isGoogleOnlyUser(user)) {
      return res.status(401).json({ error: "This account uses Google. Click Continue with Google." });
    }

    if (!user.password) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    await promoteAdminIfNeeded(user);

    const token = signToken(user);
    setAuthCookie(res, token);

    return res.json({
      token,
      user: toPublicUser(user),
      redirect: getPostLoginPath(Boolean(user.isAdmin)),
    });
  } catch {
    return res.status(500).json({ error: "Login failed" });
  }
});

router.get("/api/auth/me", requireAuth, async (req: AuthRequest, res) => {
  const user = await User.findById(req.user!.id);
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json({ user: toPublicUser(user) });
});

router.post("/api/auth/logout", (_req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

router.post("/api/auth/change-password", requireAuth, async (req: AuthRequest, res) => {
  try {
    const currentPassword = String(req.body.currentPassword ?? "");
    const newPassword = String(req.body.newPassword ?? "");

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "Current and new password required" });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: "New password must be at least 6 characters" });
    }

    const user = await User.findById(req.user!.id);
    if (!user) return res.status(404).json({ error: "User not found" });

    if (isGoogleOnlyUser(user)) {
      return res.status(400).json({
        error: "Your account uses Google sign-in. Set a password via Forgot Password if needed.",
      });
    }

    if (!user.password) {
      return res.status(400).json({ error: "No password set on this account." });
    }

    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) return res.status(401).json({ error: "Current password is incorrect" });

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    res.json({ message: "Password changed successfully" });
  } catch {
    res.status(500).json({ error: "Could not change password" });
  }
});

router.post("/api/auth/forgot-password", async (req, res) => {
  try {
    const email = String(req.body.email ?? "").trim().toLowerCase();
    if (!email) return res.status(400).json({ error: "Email is required" });

    const user = await User.findOne({ email });
    const genericMsg = "If that email exists, a reset link has been generated.";

    if (!user) {
      return res.json({ message: genericMsg });
    }

    if (isGoogleOnlyUser(user)) {
      return res.json({
        message: "This account uses Google sign-in. Please use Continue with Google on the login page.",
      });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    user.resetToken = crypto.createHash("sha256").update(resetToken).digest("hex");
    user.resetExpires = new Date(Date.now() + 60 * 60 * 1000);
    await user.save();

    const resetUrl = `${process.env.APP_URL || "http://localhost:3000"}/reset-password?token=${resetToken}`;

    const emailResult = await sendPasswordResetEmail(user.email, user.fullname, resetUrl);

    res.json({
      message: emailResult.sent
        ? "If that email exists, we sent a password reset link."
        : genericMsg,
      resetUrl: !emailResult.sent && !isEmailConfigured() ? resetUrl : undefined,
    });
  } catch {
    res.status(500).json({ error: "Could not process request" });
  }
});

router.post("/api/auth/reset-password", async (req, res) => {
  try {
    const token = String(req.body.token ?? "");
    const newPassword = String(req.body.newPassword ?? "");

    if (!token || !newPassword) {
      return res.status(400).json({ error: "Token and new password required" });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
    const user = await User.findOne({
      resetToken: hashedToken,
      resetExpires: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({ error: "Invalid or expired reset link" });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    user.resetToken = undefined;
    user.resetExpires = undefined;
    await user.save();

    res.json({ message: "Password reset successful. You can login now." });
  } catch {
    res.status(500).json({ error: "Could not reset password" });
  }
});

export default router;
