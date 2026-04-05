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

  const seenTxIds = new Set<string>();
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

      const txId = cols[2] || null;

      // CSV内の重複を除去
      if (txId) {
        if (seenTxIds.has(txId)) continue;
        seenTxIds.add(txId);
      }

      // 日付フォーマット変換: 2026/01/01 → 2026-01-01
      const rawDate = cols[0] || "";
      const transactionDate = rawDate.includes("/") ? rawDate.replace(/\//g, "-") : rawDate || new Date().toISOString().split("T")[0];

      rows.push({
        transaction_date: transactionDate,
        store: cols[1] || "",
        transaction_id: txId,
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

  // バッチに分割して挿入（Supabaseの行数制限を回避）
  const BATCH_SIZE = 500;
  let imported = 0;

  for (let i = 0; i < newRows.length; i += BATCH_SIZE) {
    const batch = newRows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from("credit_payments").insert(batch);
    if (error) {
      return NextResponse.json({ error: error.message, imported }, { status: 500 });
    }
    imported += batch.length;
  }

  const skipped = rows.length - newRows.length;
  return NextResponse.json({ imported, skipped });
}
