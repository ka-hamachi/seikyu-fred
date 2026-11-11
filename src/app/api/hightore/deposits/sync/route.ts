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

  // サービスごとに並列で取得し、1つが失敗しても他は保存する
  const results: DepositSyncResult[] = await Promise.all(
    DEPOSIT_PROVIDERS.map(async ({ id: provider }): Promise<DepositSyncResult> => {
      // BluePay は一覧を取得するAPIがなく、Webhook（/api/hightore/bluepay/webhook）で反映する
      if (provider === "bluepay") {
        return { provider, status: process.env.BLUEPAY_TENANT_ID ? "webhook" : "not_configured", count: 0 };
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

  return NextResponse.json({ from, to, results });
}
