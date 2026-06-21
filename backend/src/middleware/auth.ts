import { Request, Response, NextFunction } from "express";
import { User } from "../models/User";
import { COOKIE_NAME, JwtPayload, verifyToken } from "../utils/jwt";

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    fullname: string;
    phone: string;
    address: string;
    city: string;
    pincode: string;
    isAdmin: boolean;
  };
}

function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }
  return req.cookies?.[COOKIE_NAME] ?? null;
}

export async function optionalAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const token = extractToken(req);

  if (!token) {
    res.locals.user = null;
    return next();
  }

  try {
    const payload = verifyToken(token) as JwtPayload;
    const user = await User.findById(payload.userId).select(
      "fullname email phone address city pincode isAdmin"
    );
    if (user) {
      req.user = {
        id: user._id.toString(),
        email: user.email,
        fullname: user.fullname,
        phone: user.phone ?? "",
        address: user.address ?? "",
        city: user.city ?? "",
        pincode: user.pincode ?? "",
        isAdmin: Boolean(user.isAdmin),
      };
      res.locals.user = req.user;
      res.locals.isAdmin = Boolean(user.isAdmin);
    }
  } catch {
    res.clearCookie(COOKIE_NAME);
    res.locals.user = null;
  }

  next();
}

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  await optionalAuth(req, res, () => {
    if (!req.user) {
      return res.status(401).json({ error: "Login required. Please sign in first." });
    }
    next();
  });
}

export async function requireAuthPage(req: AuthRequest, res: Response, next: NextFunction) {
  await optionalAuth(req, res, () => {
    if (!req.user) {
      return res.redirect("/login");
    }
    next();
  });
}

export async function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  await requireAuth(req, res, () => {
    if (!req.user?.isAdmin) {
      return res.status(403).json({ error: "Admin access required" });
    }
    next();
  });
}

export async function requireAdminPage(req: AuthRequest, res: Response, next: NextFunction) {
  await optionalAuth(req, res, () => {
    if (!req.user) return res.redirect("/login?redirect=/admin");
    if (!req.user.isAdmin) return res.redirect("/?error=admin_denied");
    next();
  });
}
