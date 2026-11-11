import type { DepositProviderAdapter, FetchedDeposit } from "./types";

// fincode の売上入金（GET /v1/accounts）のうち「入金済み」を入金として取り込む
// 環境変数: FINCODE_SECRET_KEY（ダッシュボードで発行するシークレットキー m_prod_...）

const BASE_URL = "https://api.fincode.jp";
const STATUS_DEPOSITED = 3003; // 入金済み

interface FincodeAccount {
  id: string;
  status_code: number;
  deposit_date: string | null; // 入金実績日 "yyyy/MM/dd HH:mm"
  deposit_amount: number;
  aggregate_term_start: string;
  aggregate_term_end: string;
}

// "2026-11-30" ± days → "2026/11/20"（fincode の日付形式）
function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10).replace(/-/g, "/");
}

// "2026/11/30 00:00" → "2026-11-30"
function toIsoDate(fincodeDate: string): string {
  return fincodeDate.slice(0, 10).replace(/\//g, "-");
}

export const fincodeAdapter: DepositProviderAdapter = {
  provider: "fincode",

  isConfigured() {
    return Boolean(process.env.FINCODE_SECRET_KEY);
  },

  async fetchDeposits(from, to) {
    const deposits: FetchedDeposit[] = [];
    let page = 1;
    let lastPage = 1;

    do {
      // 絞り込みは入金予定日でしかできず、休日で実際の振込日が前後するので前後10日広げて取り、振込日で絞る
      const params = new URLSearchParams({
        limit: "100",
        page: String(page),
        status: String(STATUS_DEPOSITED),
        scheduled_from: shiftDate(from, -10),
        scheduled_to: shiftDate(to, 10),
      });

      const res = await fetch(`${BASE_URL}/v1/accounts?${params}`, {
        headers: { Authorization: `Bearer ${process.env.FINCODE_SECRET_KEY}` },
        cache: "no-store",
      });
      const body = await res.json();
      if (!res.ok) {
        const message = body?.errors?.map((e: { error_message?: string }) => e.error_message).join(" / ");
        throw new Error(message || `HTTP ${res.status}`);
      }
      if (!body.total_count) break;

      for (const a of (body.list || []) as FincodeAccount[]) {
        if (a.status_code !== STATUS_DEPOSITED || !a.deposit_date) continue;
        const depositDate = toIsoDate(a.deposit_date);
        if (depositDate < from || depositDate >= to) continue;
        deposits.push({
          externalId: a.id,
          depositDate,
          amount: a.deposit_amount,
          memo: `集計期間 ${toIsoDate(a.aggregate_term_start)}〜${toIsoDate(a.aggregate_term_end)}`,
        });
      }

      lastPage = body.last_page || 1;
      page++;
    } while (page <= lastPage);

    return deposits;
  },
};
