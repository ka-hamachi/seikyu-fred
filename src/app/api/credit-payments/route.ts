import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month");

  let query = supabase
    .from("credit_payments")
    .select("*")
    .order("transaction_date", { ascending: false })
    .limit(10000);

  if (month) {
    const [y, m] = month.split("-").map(Number);
    const start = `${month}-01`;
    const nextMonth = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
    query = query.gte("transaction_date", start).lt("transaction_date", nextMonth);
  }

  const { data, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const payments = (data || []).map((row) => ({
    id: row.id,
    store: row.store || "",
    withdrawal: row.withdrawal || 0,
    deposit: row.deposit || 0,
    transactionDate: row.transaction_date,
    cardName: row.card_name || "",
    createdAt: row.created_at,
  }));

  return NextResponse.json(payments);
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  const { data, error } = await supabase
    .from("credit_payments")
    .insert({
      store: body.store || "",
      withdrawal: Number(body.withdrawal) || 0,
      deposit: Number(body.deposit) || 0,
      transaction_date: body.transactionDate || new Date().toISOString().split("T")[0],
      card_name: body.cardName || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const { id, ...updates } = body;

  const dbUpdates: Record<string, unknown> = {};
  if (updates.store !== undefined) dbUpdates.store = updates.store;
  if (updates.withdrawal !== undefined) dbUpdates.withdrawal = Number(updates.withdrawal);
  if (updates.deposit !== undefined) dbUpdates.deposit = Number(updates.deposit);
  if (updates.transactionDate !== undefined) dbUpdates.transaction_date = updates.transactionDate;
  if (updates.cardName !== undefined) dbUpdates.card_name = updates.cardName;

  const { data, error } = await supabase
    .from("credit_payments")
    .update(dbUpdates)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const { error } = await supabase.from("credit_payments").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
