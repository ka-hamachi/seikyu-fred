import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { DEPOSIT_ADAPTERS } from "@/lib/deposit-providers";
import { DEPOSIT_PROVIDERS } from "@/lib/deposit-providers/labels";
import type { DepositSyncResult } from "@/types";

export const dynamic = "force-dynamic";
// Amazon Pay のレポートのダウンロードなどで時間がかかることがあるため
export const maxDuration = 300;

function nextMonthStart(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
}

function addMonths(month: string, diff: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + diff, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * 各決済サービスのAPIから入金（振込）を取得して hightore_deposits に保存する
 * body: { month: "YYYY-MM", months?: number }  month を最後の月として months ヶ月分（既定1）
 */
export async function POST(req: NextRequest) {
  const { month, months = 1 } = await req.json();
  if (!/^\d{4}-\d{2}$/.test(month || "")) {
    return NextResponse.json({ error: "month (YYYY-MM) required" }, { status: 400 });
  }

  const from = `${addMonths(month, -(Math.min(Math.max(Number(months) || 1, 1), 24) - 1))}-01`;
  const to = nextMonthStart(month);

  return NextResponse.json({ from, to, results: await syncDeposits(from, to) });
}

/**
 * Vercel Cron（vercel.json）から毎日呼ばれる自動同期。先月と今月の分を取り込む
 * （同期の押し忘れや、Amazon Pay の決済レポートが90日で消えることによる取りこぼしを防ぐ）
 * Vercel は環境変数 CRON_SECRET を Authorization ヘッダーに付けて呼ぶので、それ以外からは実行させない
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const thisMonth = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 7); // 日本時間の今月
  const from = `${addMonths(thisMonth, -1)}-01`;
  const to = nextMonthStart(thisMonth);
  const results = await syncDeposits(from, to);
  console.log("[deposits cron]", from, to, JSON.stringify(results));

  return NextResponse.json({ from, to, results });
}

async function syncDeposits(from: string, to: string): Promise<DepositSyncResult[]> {
  // サービスごとに並列で取得し、1つが失敗しても他は保存する
  return Promise.all(
    DEPOSIT_PROVIDERS.map(async ({ id: provider }): Promise<DepositSyncResult> => {
      // BluePay は振込情報を取得するAPIがなく、振込申請CSV（/api/hightore/deposits/bluepay-csv）で取り込む
      if (provider === "bluepay") {
        return { provider, status: "csv", count: 0 };
      }

      const adapter = DEPOSIT_ADAPTERS[provider];
      if (!adapter || !adapter.isConfigured()) {
        return { provider, status: "not_configured", count: 0 };
      }

      try {
        const deposits = await adapter.fetchDeposits(from, to);
        if (deposits.length > 0) {
          const { error } = await supabase.from("hightore_deposits").upsert(
            deposits.map((d) => ({
              provider,
              external_id: d.externalId,
              deposit_date: d.depositDate,
              amount: d.amount,
              memo: d.memo || null,
              updated_at: new Date().toISOString(),
            })),
            { onConflict: "provider,external_id" }
          );
          if (error) throw new Error(error.message);
        }
        return { provider, status: "ok", count: deposits.length };
      } catch (err) {
        console.error(`[deposits sync] ${provider}:`, err);
        return { provider, status: "error", count: 0, error: err instanceof Error ? err.message : String(err) };
      }
    })
  );
}
