import { NextRequest, NextResponse } from "next/server";
import { supabase, fetchAll } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  // Shift-JIS対応: ArrayBufferからTextDecoderで変換
  const arrayBuffer = await file.arrayBuffer();
  let text: string;
  try {
    const decoder = new TextDecoder("shift-jis");
    text = decoder.decode(arrayBuffer);
  } catch {
    // fallback to UTF-8
    text = new TextDecoder("utf-8").decode(arrayBuffer);
  }

  const lines = text.split("\n").filter((line) => line.trim());

  if (lines.length < 2) {
    return NextResponse.json({ error: "CSV is empty" }, { status: 400 });
  }

  const rows: {
    transaction_date: string;
    store: string;
    transaction_id: string | null;
    withdrawal: number;
    deposit: number;
    card_name: string | null;
  }[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
    if (cols.length >= 6) {
      const withdrawal = Math.abs(Number(cols[4]?.replace(/[,¥￥]/g, "")) || 0);
      const deposit = Math.abs(Number(cols[5]?.replace(/[,¥￥]/g, "")) || 0);

      // Skip rows with no amounts
      if (withdrawal === 0 && deposit === 0) continue;

      rows.push({
        transaction_date: cols[0] || new Date().toISOString().split("T")[0],
        store: cols[1] || "",
        transaction_id: cols[2] || null,
        withdrawal,
        deposit,
        card_name: cols[9] || null,
      });
    }
  }

  if (rows.length === 0) {
    return NextResponse.json({ error: "有効なデータがありません" }, { status: 400 });
  }

  // 既存の決済IDを取得して重複を除外
  const txIds = rows.map((r) => r.transaction_id).filter(Boolean) as string[];
  const existingIds = new Set<string>();

  if (txIds.length > 0) {
    const { data: existing } = await fetchAll(() =>
      supabase.from("credit_payments").select("transaction_id").in("transaction_id", txIds)
    );
    for (const row of existing) {
      if (row.transaction_id) existingIds.add(row.transaction_id);
    }
  }

  const newRows = rows.filter((r) => !r.transaction_id || !existingIds.has(r.transaction_id));

  if (newRows.length === 0) {
    return NextResponse.json({ imported: 0, skipped: rows.length, message: "全て重複のためスキップしました" });
  }

  const { error } = await supabase.from("credit_payments").insert(newRows);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const skipped = rows.length - newRows.length;
  return NextResponse.json({ imported: newRows.length, skipped });
}
