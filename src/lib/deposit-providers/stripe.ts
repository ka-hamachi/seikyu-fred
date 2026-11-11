import type { DepositProviderAdapter, FetchedDeposit } from "./types";
import { jstDateToUnix, unixToJstDate } from "./types";

// Stripe の Payout（Stripe残高 → 銀行口座への振込）を入金として取り込む
// 環境変数: STRIPE_SECRET_KEY（「Payouts: 読み取り」だけ許可した制限付きキー rk_live_... を推奨）

interface StripePayout {
  id: string;
  amount: number;
  currency: string;
  arrival_date: number;
  description: string | null;
}

export const stripeAdapter: DepositProviderAdapter = {
  provider: "stripe",

  isConfigured() {
    return Boolean(process.env.STRIPE_SECRET_KEY);
  },

  async fetchDeposits(from, to) {
    const deposits: FetchedDeposit[] = [];
    let startingAfter: string | undefined;

    do {
      const params = new URLSearchParams({
        limit: "100",
        status: "paid",
        "arrival_date[gte]": String(jstDateToUnix(from)),
        "arrival_date[lt]": String(jstDateToUnix(to)),
      });
      if (startingAfter) params.set("starting_after", startingAfter);

      const res = await fetch(`https://api.stripe.com/v1/payouts?${params}`, {
        headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` },
        cache: "no-store",
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message || `HTTP ${res.status}`);

      const payouts: StripePayout[] = body.data || [];
      for (const p of payouts) {
        // 円は小数のない通貨なので amount がそのまま円。他の通貨は金額の単位が違うので止める
        if (p.currency !== "jpy") throw new Error(`円以外の入金があります: ${p.id} (${p.currency})`);
        deposits.push({
          externalId: p.id,
          depositDate: unixToJstDate(p.arrival_date),
          amount: p.amount,
          memo: p.description,
        });
      }

      startingAfter = body.has_more && payouts.length > 0 ? payouts[payouts.length - 1].id : undefined;
    } while (startingAfter);

    return deposits;
  },
};
