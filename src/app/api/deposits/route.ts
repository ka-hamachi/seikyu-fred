import { NextRequest, NextResponse } from "next/server";
import { supabase, fetchAll } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  const { data, error } = await fetchAll(() =>
    supabase.from("deposits").select("*").order("transaction_date", { ascending: false })
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const deposits = data.map((row) => ({
    id: row.id,
    company: row.company,
    amount: row.amount || 0,
    type: row.type,
    description: row.description || "",
    transactionDate: row.transaction_date,
    createdAt: row.created_at,
  }));

  return NextResponse.json(deposits);
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  const { data, error } = await supabase
    .from("deposits")
    .insert({
      company: body.company,
      amount: Number(body.amount) || 0,
      type: body.type,
      description: body.description || "",
      transaction_date: body.transactionDate || new Date().toISOString().split("T")[0],
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const { error } = await supabase.from("deposits").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
