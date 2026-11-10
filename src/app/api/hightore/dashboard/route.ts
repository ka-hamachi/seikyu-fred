import { NextRequest, NextResponse } from "next/server";
import { supabase, fetchAll } from "@/lib/supabase";
import type { HighToreDashboardSummary } from "@/types";

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

  const { data: payments, error } = await fetchAll(() =>
    supabase
      .from("hightore_payment_invoices")
      .select("amount, status, check_status")
      .gte("issue_date", firstDay)
      .lt("issue_date", lastDay)
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const unpaid = payments.filter((p) => p.status === "unpaid");

  const summary: HighToreDashboardSummary = {
    totalPayments: payments.reduce((sum, p) => sum + p.amount, 0),
    paymentsCount: payments.length,
    unpaidPaymentsAmount: unpaid.reduce((sum, p) => sum + p.amount, 0),
    unpaidPaymentsCount: unpaid.length,
    uncheckedPaymentsCount: payments.filter((p) => p.check_status !== "checked").length,
  };

  return NextResponse.json(summary);
}
