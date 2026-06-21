export interface InrToUsdResult {
  totalInr: number;
  totalUsd: number;
  usdCents: number;
  rate: number;
}

const CACHE_MS = 60 * 60 * 1000;
let cachedRate: { rate: number; at: number } | null = null;

/** 1 INR → USD (e.g. ~0.012) */
export async function getInrToUsdRate(): Promise<number> {
  const envRate = process.env.INR_USD_RATE;
  if (envRate) {
    const parsed = Number(envRate);
    if (parsed > 0) return parsed;
  }

  if (cachedRate && Date.now() - cachedRate.at < CACHE_MS) {
    return cachedRate.rate;
  }

  try {
    const res = await fetch("https://api.frankfurter.app/latest?from=INR&to=USD");
    if (!res.ok) throw new Error("Rate fetch failed");
    const data = (await res.json()) as { rates?: { USD?: number } };
    const rate = data.rates?.USD;
    if (!rate || rate <= 0) throw new Error("Invalid rate");
    cachedRate = { rate, at: Date.now() };
    return rate;
  } catch {
    return 0.012;
  }
}

export async function convertInrToUsd(totalInr: number): Promise<InrToUsdResult> {
  const rate = await getInrToUsdRate();
  const totalUsd = Math.round(totalInr * rate * 100) / 100;
  const usdCents = Math.max(50, Math.round(totalUsd * 100));
  return { totalInr, totalUsd: usdCents / 100, usdCents, rate };
}

export function formatUsd(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}
