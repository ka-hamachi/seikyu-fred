import { NextRequest, NextResponse } from "next/server";
import { supabase, fetchAll } from "@/lib/supabase";
import type { DashboardSummary } from "@/types";

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

  const [salesRes, paymentsRes, creditsRes] = await Promise.all([
    fetchAll(() =>
      supabase.from("sales_invoices").select("amount, status").gte("issue_date", firstDay).lt("issue_date", lastDay)
    ),
    fetchAll(() =>
      supabase.from("payment_invoices").select("amount, status").gte("issue_date", firstDay).lt("issue_date", lastDay)
    ),
    fetchAll(() =>
      supabase.from("credit_payments").select("withdrawal, deposit").gte("transaction_date", firstDay).lt("transaction_date", lastDay)
    ),
  ]);

  const sales = salesRes.data;
  const payments = paymentsRes.data;
  const credits = creditsRes.data;

  const totalSales = sales.reduce((sum, s) => sum + s.amount, 0);
  const totalPayments = payments.reduce((sum, p) => sum + p.amount, 0);
  const totalCredit = credits.reduce((sum, c) => sum + (c.withdrawal || 0) - (c.deposit || 0), 0);

  const summary: DashboardSummary = {
    totalSales,
    totalPayments,
    totalCredit,
    grossProfit: totalSales - totalPayments - totalCredit,
    salesCount: sales.length,
    paymentsCount: payments.length,
    creditCount: credits.length,
    unpaidSalesCount: sales.filter((s) => s.status === "unpaid").length,
    unpaidPaymentsCount: payments.filter((p) => p.status === "unpaid").length,
  };

  return NextResponse.json(summary);
}
