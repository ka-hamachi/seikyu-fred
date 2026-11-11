import { NextRequest, NextResponse } from "next/server";
import { supabase, fetchAll } from "@/lib/supabase";
import type { DepositProvider, HighToreDashboardSummary } from "@/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month");

  const now = new Date();
  const targetMonth = month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  // Calculate first and last day of month
  const [year, mon] = targetMonth.split("-").map(Number);
  const firstDay = `${targetMonth}-01`;
  const lastDay = mon === 12 ? `${year + 1}-01-01` : `${year}-${String(mon + 1).padStart(2, "0")}-01`;

  const [paymentsRes, depositsRes] = await Promise.all([
    fetchAll(() =>
      supabase
        .from("hightore_payment_invoices")
        .select("amount, status, check_status")
        .gte("issue_date", firstDay)
        .lt("issue_date", lastDay)
    ),
    fetchAll(() =>
      supabase
        .from("hightore_deposits")
        .select("provider, amount")
        .gte("deposit_date", firstDay)
        .lt("deposit_date", lastDay)
    ),
  ]);

  const error = paymentsRes.error || depositsRes.error;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const payments = paymentsRes.data;
  const deposits = depositsRes.data;
  const unpaid = payments.filter((p) => p.status === "unpaid");

  const depositsByProvider: Record<DepositProvider, number> = { fincode: 0, amazon_pay: 0, stripe: 0, bluepay: 0 };
  for (const d of deposits) {
    depositsByProvider[d.provider as DepositProvider] += Number(d.amount) || 0;
  }
  const totalDeposits = Object.values(depositsByProvider).reduce((sum, v) => sum + v, 0);
  const totalPayments = payments.reduce((sum, p) => sum + p.amount, 0);
  // 在庫の入力方法が決まるまでは0として扱う
  const inventoryAmount = 0;

  const summary: HighToreDashboardSummary = {
    totalDeposits,
    depositsByProvider,
    totalPayments,
    paymentsCount: payments.length,
    unpaidPaymentsAmount: unpaid.reduce((sum, p) => sum + p.amount, 0),
    unpaidPaymentsCount: unpaid.length,
    uncheckedPaymentsCount: payments.filter((p) => p.check_status !== "checked").length,
    inventoryAmount,
    grossProfit: totalDeposits - totalPayments + inventoryAmount,
  };

  return NextResponse.json(summary);
}
