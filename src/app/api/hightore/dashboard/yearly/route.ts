import { NextRequest, NextResponse } from "next/server";
import { supabase, fetchAll } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const year = Number(searchParams.get("year")) || new Date().getFullYear();

  const firstDay = `${year}-01-01`;
  const lastDay = `${year + 1}-01-01`;

  const [paymentsRes, depositsRes] = await Promise.all([
    fetchAll(() =>
      supabase.from("hightore_payment_invoices").select("amount, issue_date").gte("issue_date", firstDay).lt("issue_date", lastDay)
    ),
    fetchAll(() =>
      supabase.from("hightore_deposits").select("amount, deposit_date").gte("deposit_date", firstDay).lt("deposit_date", lastDay)
    ),
  ]);

  const error = paymentsRes.error || depositsRes.error;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const payments = paymentsRes.data;
  const deposits = depositsRes.data;

  // 月ごとに集計
  const months = Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;
    const prefix = `${year}-${String(month).padStart(2, "0")}`;

    const monthDeposits = deposits
      .filter((d) => d.deposit_date.startsWith(prefix))
      .reduce((sum, d) => sum + (Number(d.amount) || 0), 0);

    const monthPayments = payments
      .filter((p) => p.issue_date.startsWith(prefix))
      .reduce((sum, p) => sum + p.amount, 0);

    // 在庫の入力方法が決まるまでは0として扱う
    const monthInventory = 0;

    return {
      month,
      label: `${month}月`,
      deposits: monthDeposits,
      payments: monthPayments,
      inventory: monthInventory,
      grossProfit: monthDeposits - monthPayments + monthInventory,
    };
  });

  return NextResponse.json({ year, months });
}
