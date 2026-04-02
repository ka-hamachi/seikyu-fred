import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

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
        withdrawal,
        deposit,
        card_name: cols[9] || null,
      });
    }
  }

  if (rows.length === 0) {
    return NextResponse.json({ error: "有効なデータがありません" }, { status: 400 });
  }

  const { error } = await supabase.from("credit_payments").insert(rows);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ imported: rows.length });
}
