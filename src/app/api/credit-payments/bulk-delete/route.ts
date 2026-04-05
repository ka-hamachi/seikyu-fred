import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const ids: string[] = body?.ids;

  if (!ids || ids.length === 0) {
    return NextResponse.json({ error: "ids required" }, { status: 400 });
  }

  // バッチに分割して削除（Supabaseの制限を回避）
  const BATCH_SIZE = 200;
  let deleted = 0;

  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    const batch = ids.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from("credit_payments").delete().in("id", batch);
    if (error) {
      return NextResponse.json({ error: error.message, deleted }, { status: 500 });
    }
    deleted += batch.length;
  }

  return NextResponse.json({ success: true, deleted });
}
