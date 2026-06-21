import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { PROJECT_ROOT } from "../utils/paths";

/** Load frontend/.env — only non-empty values override backend/.env */
export function loadFrontendEnv(): void {
  const envPath = path.join(PROJECT_ROOT, "frontend", ".env");
  if (!fs.existsSync(envPath)) return;

  const parsed = dotenv.parse(fs.readFileSync(envPath));
  for (const [key, value] of Object.entries(parsed)) {
    const trimmed = value.trim();
    if (trimmed !== "") {
      process.env[key] = trimmed;
    }
  }
}
