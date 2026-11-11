import { NextRequest, NextResponse } from "next/server";
import { supabase, fetchAll } from "@/lib/supabase";
import { DEPOSIT_PROVIDERS } from "@/lib/deposit-providers/labels";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const month = new URL(req.url).searchParams.get("month");

  const { data, error } = await fetchAll(() => {
    let q = supabase.from("hightore_deposits").select("*").order("deposit_date", { ascending: false });
    if (month) {
      const [y, m] = month.split("-").map(Number);
      const nextMonth = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
      q = q.gte("deposit_date", `${month}-01`).lt("deposit_date", nextMonth);
    }
    return q;
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const deposits = data.map((row) => ({
    id: row.id,
    provider: row.provider,
    externalId: row.external_id,
    depositDate: row.deposit_date,
    amount: Number(row.amount) || 0,
    memo: row.memo || "",
    createdAt: row.created_at,
  }));

  return NextResponse.json(deposits);
}

// 手動追加（APIで取れない入金の補正用）
export async function POST(req: NextRequest) {
  const body = await req.json();

  if (!DEPOSIT_PROVIDERS.some((p) => p.id === body.provider)) {
    return NextResponse.json({ error: "invalid provider" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("hightore_deposits")
    .insert({
      provider: body.provider,
      external_id: `manual-${crypto.randomUUID()}`,
      deposit_date: body.depositDate || new Date().toISOString().split("T")[0],
      amount: Number(body.amount) || 0,
      memo: body.memo || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const { error } = await supabase.from("hightore_deposits").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
