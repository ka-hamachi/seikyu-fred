import { NextRequest, NextResponse } from "next/server";
import { supabase, fetchAll } from "@/lib/supabase";

/** クォート内のカンマを正しく処理するCSVパーサー */
function parseCSVLine(line: string): string[] {
  const cols: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      cols.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  cols.push(current.trim());
  return cols;
}

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

  const seenKeys = new Set<string>();
  const rows: {
    transaction_date: string;
    store: string;
    transaction_id: string | null;
    withdrawal: number;
    deposit: number;
    card_name: string | null;
  }[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    if (cols.length >= 6) {
      const withdrawal = Math.abs(Number(cols[4]?.replace(/[,¥￥]/g, "")) || 0);
      const deposit = Math.abs(Number(cols[5]?.replace(/[,¥￥]/g, "")) || 0);

      // Skip rows with no amounts
      if (withdrawal === 0 && deposit === 0) continue;

      const txId = cols[2] || null;

      // 日付フォーマット変換: 2026/01/01 → 2026-01-01
      const rawDate = cols[0] || "";
      const transactionDate = rawDate.includes("/") ? rawDate.replace(/\//g, "-") : rawDate || new Date().toISOString().split("T")[0];

      // CSV内の重複を除去（決済ID + 取引日）
      if (txId) {
        const key = `${txId}|${transactionDate}`;
        if (seenKeys.has(key)) continue;
        seenKeys.add(key);
      }

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

  // 既存の決済ID+取引日を取得して重複を除外
  const txIds = [...new Set(rows.map((r) => r.transaction_id).filter(Boolean) as string[])];
  const existingKeys = new Set<string>();

  const IN_BATCH = 100;
  for (let i = 0; i < txIds.length; i += IN_BATCH) {
    const batch = txIds.slice(i, i + IN_BATCH);
    const { data: existing } = await supabase
      .from("credit_payments")
      .select("transaction_id, transaction_date")
      .in("transaction_id", batch);
    for (const row of existing || []) {
      if (row.transaction_id) existingKeys.add(`${row.transaction_id}|${row.transaction_date}`);
    }
  }

  const newRows = rows.filter((r) => {
    if (!r.transaction_id) return true;
    return !existingKeys.has(`${r.transaction_id}|${r.transaction_date}`);
  });

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
