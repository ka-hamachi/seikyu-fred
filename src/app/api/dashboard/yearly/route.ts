import { NextRequest, NextResponse } from "next/server";
import { supabase, fetchAll } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const year = Number(searchParams.get("year")) || new Date().getFullYear();

  const firstDay = `${year}-01-01`;
  const lastDay = `${year + 1}-01-01`;

  const [salesRes, paymentsRes, creditsRes] = await Promise.all([
    fetchAll(() =>
      supabase.from("sales_invoices").select("amount, issue_date").gte("issue_date", firstDay).lt("issue_date", lastDay)
    ),
    fetchAll(() =>
      supabase.from("payment_invoices").select("amount, issue_date").gte("issue_date", firstDay).lt("issue_date", lastDay)
    ),
    fetchAll(() =>
      supabase.from("credit_payments").select("withdrawal, deposit, transaction_date").gte("transaction_date", firstDay).lt("transaction_date", lastDay)
    ),
  ]);

  const sales = salesRes.data;
  const payments = paymentsRes.data;
  const credits = creditsRes.data;

  // 月ごとに集計
  const months = Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;
    const prefix = `${year}-${String(month).padStart(2, "0")}`;

    const monthSales = sales
      .filter((s) => s.issue_date.startsWith(prefix))
      .reduce((sum, s) => sum + s.amount, 0);

    const monthPayments = payments
      .filter((p) => p.issue_date.startsWith(prefix))
      .reduce((sum, p) => sum + p.amount, 0);

    const monthCredit = credits
      .filter((c) => c.transaction_date.startsWith(prefix))
      .reduce((sum, c) => sum + (c.withdrawal || 0) - (c.deposit || 0), 0);

    return {
      month,
      label: `${month}月`,
      sales: monthSales,
      payments: monthPayments,
      credit: monthCredit,
      grossProfit: monthSales - monthPayments - monthCredit,
    };
  });

  return NextResponse.json({ year, months });
}
