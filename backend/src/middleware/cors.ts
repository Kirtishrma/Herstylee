import { Request, Response, NextFunction } from "express";

/** Enable cross-origin API calls when frontend and backend are on different domains. */
export function corsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const frontendUrl = process.env.FRONTEND_URL?.trim();
  if (!frontendUrl) {
    next();
    return;
  }

  res.header("Access-Control-Allow-Origin", frontendUrl);
  res.header("Access-Control-Allow-Credentials", "true");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");

  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }

  next();
}
