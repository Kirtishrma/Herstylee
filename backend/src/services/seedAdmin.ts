import { IUser, User } from "../models/User";

export function getPostLoginPath(isAdmin: boolean): string {
  return isAdmin ? "/admin" : "/profile";
}

/** Comma-separated ADMIN_EMAILS and/or legacy ADMIN_EMAIL. */
export function getAdminEmails(): string[] {
  const emails: string[] = [];

  const fromList = process.env.ADMIN_EMAILS?.split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (fromList?.length) emails.push(...fromList);

  const single = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (single) emails.push(single);

  return [...new Set(emails)];
}

export function isAdminEmail(email: string): boolean {
  return getAdminEmails().includes(email.toLowerCase());
}

export async function promoteAdminIfNeeded(user: IUser): Promise<void> {
  if (!isAdminEmail(user.email)) return;
  if (!user.isAdmin) {
    user.isAdmin = true;
    await user.save();
  }
}

export async function ensureAdminUser() {
  const emails = getAdminEmails();
  if (!emails.length) return;

  for (const email of emails) {
    const result = await User.updateOne({ email }, { $set: { isAdmin: true } });
    if (result.matchedCount > 0) {
      console.log(`Admin access granted to ${email}`);
    } else {
      console.log(`Admin email ${email} — user not found yet. Register first, then restart.`);
    }
  }
}
