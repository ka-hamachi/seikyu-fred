import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/**
 * BluePay の振込申請CSV（管理画面「取引履歴 > 振込申請履歴」の各行の「CSV出力」）を入金として取り込む
 * BluePay の API には振込情報を取得する機能がないため、CSVで取り込む。
 *
 * CSVの先頭は振込1件分のまとめ（キー,値）で、空行のあとに対象取引の明細が続く:
 *   振込申請ID,59 / ステータス,APPROVED / 処理日時,2026-11-10T10:14:00.08 / 注文総額,… / 手数料,… / 振込金額,3954404
 * 処理日時を振込日、振込金額を入金額として、振込申請IDで重複を防ぐ（同じCSVを再度取り込んでも上書きされるだけ）
 */

function decode(bytes: ArrayBuffer): string {
  const utf8 = new TextDecoder("utf-8").decode(bytes);
  return utf8.includes("�") ? new TextDecoder("shift-jis").decode(bytes) : utf8;
}

// 先頭の「キー,値」のまとめ部分を読む（空行または明細の見出しまで）
function parseSummary(text: string): Record<string, string> {
  const summary: Record<string, string> = {};
  for (const line of text.replace(/^﻿/, "").split(/\r?\n/)) {
    if (!line.trim()) break;
    const [key, ...rest] = line.split(",");
    summary[key.trim().replace(/^"|"$/g, "")] = rest.join(",").trim().replace(/^"|"$/g, "");
  }
  return summary;
}

const formatYen = (n: number) => `¥${n.toLocaleString("ja-JP")}`;

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const files = formData.getAll("files").filter((f): f is File => f instanceof File);
  if (files.length === 0) {
    return NextResponse.json({ error: "CSVファイルを選んでください" }, { status: 400 });
  }

  const results: { fileName: string; status: "imported" | "skipped" | "error"; message: string }[] = [];

  for (const file of files) {
    const s = parseSummary(decode(await file.arrayBuffer()));
    const applicationId = s["振込申請ID"];
    const processedAt = s["処理日時"];
    const amount = Number(s["振込金額"]);

    if (!applicationId || !processedAt || !Number.isFinite(amount)) {
      results.push({ fileName: file.name, status: "error", message: "BluePayの振込申請CSVの形式ではありません" });
      continue;
    }
    // 振込完了（APPROVED）のものだけ入金として扱う
    if (s["ステータス"] !== "APPROVED") {
      results.push({ fileName: file.name, status: "skipped", message: `振込申請 #${applicationId} はまだ振込完了ではありません（${s["ステータス"]}）` });
      continue;
    }

    const memoParts = [
      `振込申請 #${applicationId}`,
      s["対象取引件数"] ? `取引${s["対象取引件数"]}件` : "",
      s["注文総額"] ? `注文総額 ${formatYen(Number(s["注文総額"]))}` : "",
      s["手数料"] ? `手数料 ${formatYen(Number(s["手数料"]))}` : "",
      Number(s["返金総額"]) ? `返金 ${formatYen(Number(s["返金総額"]))}` : "",
    ].filter(Boolean);

    const { error } = await supabase.from("hightore_deposits").upsert(
      {
        provider: "bluepay",
        external_id: `settlement-application-${applicationId}`,
        // "2026-11-10T10:14:00.082503"（日本時間、タイムゾーンなし）の日付部分
        deposit_date: processedAt.slice(0, 10),
        amount,
        memo: memoParts.join(" / "),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "provider,external_id" }
    );

    results.push(
      error
        ? { fileName: file.name, status: "error", message: error.message }
        : { fileName: file.name, status: "imported", message: `振込申請 #${applicationId}: ${processedAt.slice(0, 10)} ${formatYen(amount)}` }
    );
  }

  return NextResponse.json({ results });
}
