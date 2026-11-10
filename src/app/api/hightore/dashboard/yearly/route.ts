import { NextRequest, NextResponse } from "next/server";
import { supabase, fetchAll } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const year = Number(searchParams.get("year")) || new Date().getFullYear();

  const firstDay = `${year}-01-01`;
  const lastDay = `${year + 1}-01-01`;

  const { data: payments, error } = await fetchAll(() =>
    supabase.from("hightore_payment_invoices").select("amount, issue_date").gte("issue_date", firstDay).lt("issue_date", lastDay)
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 月ごとに集計
  const months = Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;
    const prefix = `${year}-${String(month).padStart(2, "0")}`;

    return {
      month,
      label: `${month}月`,
      payments: payments
        .filter((p) => p.issue_date.startsWith(prefix))
        .reduce((sum, p) => sum + p.amount, 0),
    };
  });

  return NextResponse.json({ year, months });
}
