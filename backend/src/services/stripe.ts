import Stripe from "stripe";
import { convertInrToUsd, formatUsd } from "./currency";

let stripeClient: Stripe | null = null;

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not configured");
  if (!stripeClient) stripeClient = new Stripe(key);
  return stripeClient;
}

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export async function createCheckoutSession(opts: {
  orderId: string;
  userId: string;
  userEmail: string;
  totalInr: number;
  itemCount: number;
}): Promise<{ sessionId: string; url: string; totalUsd: number; usdCents: number; rate: number }> {
  const stripe = getStripe();
  const appUrl = process.env.APP_URL || "http://localhost:3000";
  const { totalInr, totalUsd, usdCents, rate } = await convertInrToUsd(opts.totalInr);

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: opts.userEmail,
    line_items: [
      {
        price_data: {
          currency: "usd",
          unit_amount: usdCents,
          product_data: {
            name: "HERSTYLE Order",
            description: `${opts.itemCount} item(s) · ₹${opts.totalInr.toLocaleString("en-IN")} INR → ${formatUsd(totalUsd)} USD`,
          },
        },
        quantity: 1,
      },
    ],
    metadata: {
      orderId: opts.orderId,
      userId: opts.userId,
      totalInr: String(opts.totalInr),
      totalUsd: String(totalUsd),
      exchangeRate: String(rate),
    },
    success_url: `${appUrl}/orders?success=1&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/checkout?cancelled=1`,
  });

  if (!session.url) throw new Error("Stripe did not return a checkout URL");

  return {
    sessionId: session.id,
    url: session.url,
    totalUsd,
    usdCents,
    rate,
  };
}
