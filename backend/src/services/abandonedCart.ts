import { Cart } from "../models/Cart";
import { User } from "../models/User";
import { sendAbandonedCartEmail, isEmailConfigured } from "./email";

const ABANDON_AFTER_MS = Number(process.env.ABANDON_CART_AFTER_MS) || 60 * 60 * 1000;
const CHECK_INTERVAL_MS = Number(process.env.ABANDON_CART_CHECK_MS) || 15 * 60 * 1000;

function getProductId(ref: unknown): string {
  if (!ref) return "";
  if (typeof ref === "object" && ref !== null && "_id" in ref) {
    return (ref as { _id: { toString(): string } })._id.toString();
  }
  return String(ref);
}

export async function processAbandonedCarts(): Promise<number> {
  if (!isEmailConfigured()) return 0;

  const cutoff = new Date(Date.now() - ABANDON_AFTER_MS);

  const carts = await Cart.find({
    "items.0": { $exists: true },
    updatedAt: { $lte: cutoff },
    abandonedReminderSentAt: null,
  })
    .populate("items.product")
    .limit(50);

  let sent = 0;

  for (const cart of carts) {
    const user = await User.findById(cart.user).lean();
    if (!user?.email) continue;

    const items = cart.items
      .map((item) => {
        const p = item.product as unknown as {
          _id: { toString(): string };
          name: string;
          slug: string;
          image: string;
          price: number;
        } | null;
        if (!p) return null;
        return {
          name: p.name,
          slug: p.slug,
          image: p.image,
          price: p.price,
          quantity: item.quantity,
          size: item.size || "M",
        };
      })
      .filter(Boolean) as Array<{
      name: string;
      slug: string;
      image: string;
      price: number;
      quantity: number;
      size: string;
    }>;

    if (!items.length) continue;

    const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

    try {
      await sendAbandonedCartEmail(user.email, user.fullname, { items, total });
      cart.abandonedReminderSentAt = new Date();
      await cart.save();
      sent++;
    } catch (err) {
      console.error("[abandoned-cart]", user.email, err instanceof Error ? err.message : err);
    }
  }

  return sent;
}

export function startAbandonedCartScheduler(): void {
  const run = () => {
    processAbandonedCarts()
      .then((count) => {
        if (count > 0) console.log(`[abandoned-cart] Sent ${count} reminder(s)`);
      })
      .catch((err) => console.error("[abandoned-cart]", err instanceof Error ? err.message : err));
  };

  setTimeout(run, 30_000);
  setInterval(run, CHECK_INTERVAL_MS);
}

export async function resetAbandonedReminder(userId: string): Promise<void> {
  await Cart.updateOne({ user: userId, abandonedReminderSentAt: { $ne: null } }, { abandonedReminderSentAt: null });
}
