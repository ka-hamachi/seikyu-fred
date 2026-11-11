import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

/**
 * BluePay の Webhook 受信
 * BluePay の API には注文一覧や振込（精算）を取得する機能がないため、決済ごとの通知を受けて入金売上に反映する。
 * - order.paid: 決済額（手数料差し引き後の円 settlementAmount）を決済日 paidAt で登録
 * - refund.completed: 返金は全額のみなので、元の注文の金額を0にする
 *
 * 環境変数: BLUEPAY_TENANT_ID（管理画面に表示される店舗ID。他の加盟店宛ての通知を受け付けないため必須）
 *          BLUEPAY_PLATFORM_JWKS（署名検証用の公開鍵。PLATFORM_KEY_URL をブラウザで開いた内容）
 * BluePay管理画面の「API Key > Webhook」に https://<公開URL>/api/hightore/bluepay/webhook を設定して有効にする
 */

const PLATFORM_KEY_URL = "https://merchant-api.bluepay.jp/api/public/platform-key";
// 再送は最大24時間後まであるので、署名時刻は3日まで受け付ける（同じ通知は上書きされるだけなので重複しても問題ない）
const TIMESTAMP_TOLERANCE_SECONDS = 3 * 24 * 60 * 60;

let cachedKeys: crypto.JsonWebKey[] = [];

// 環境変数 BLUEPAY_PLATFORM_JWKS に PLATFORM_KEY_URL の内容（JSON）を設定しておけば、それを使う
// （PLATFORM_KEY_URL はボット対策でサーバーからの取得が弾かれることがあるため）
function configuredKeys(): crypto.JsonWebKey[] {
  try {
    return JSON.parse(process.env.BLUEPAY_PLATFORM_JWKS || "").keys || [];
  } catch {
    return [];
  }
}

async function getPlatformKey(kid: string): Promise<crypto.JsonWebKey | undefined> {
  let key = [...configuredKeys(), ...cachedKeys].find((k) => k.kid === kid);
  if (!key) {
    // 鍵の切り替えに備えて、見つからなければ取り直す
    try {
      const res = await fetch(PLATFORM_KEY_URL, { headers: { Accept: "application/json" }, cache: "no-store" });
      cachedKeys = (await res.json()).keys || [];
      key = cachedKeys.find((k) => k.kid === kid);
    } catch (err) {
      console.error("[bluepay webhook] platform-key fetch failed:", err);
    }
  }
  return key;
}

// "2026-05-01T10:01:28"（タイムゾーンなし。日本時間とみなす）→ "2026-05-01"
function toDate(timestamp: string): string {
  return timestamp.slice(0, 10);
}

export async function POST(req: NextRequest) {
  const tenantId = process.env.BLUEPAY_TENANT_ID;
  if (!tenantId) {
    return NextResponse.json({ error: "BLUEPAY_TENANT_ID is not configured" }, { status: 503 });
  }

  // 署名は受け取った生のボディに対して検証する（JSONを読み直してから検証しない）
  const rawBody = await req.text();
  const signature = req.headers.get("x-bp-signature");
  const kid = req.headers.get("x-bp-key-id");
  const timestamp = req.headers.get("x-bp-timestamp");
  const event = req.headers.get("x-bp-event");

  if (!signature || !kid || !timestamp) {
    return NextResponse.json({ error: "missing signature headers" }, { status: 400 });
  }
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > TIMESTAMP_TOLERANCE_SECONDS) {
    return NextResponse.json({ error: "timestamp out of range" }, { status: 400 });
  }

  const jwk = await getPlatformKey(kid);
  const verified =
    jwk !== undefined &&
    crypto.verify(
      "sha256",
      Buffer.from(`${timestamp}.${rawBody}`, "utf8"),
      crypto.createPublicKey({ key: jwk, format: "jwk" }),
      Buffer.from(signature, "base64")
    );
  if (!verified) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  const payload = JSON.parse(rawBody);
  if (payload.tenantId !== tenantId) {
    return NextResponse.json({ error: "unknown tenant" }, { status: 403 });
  }

  if (event === "order.paid" && payload.status === "PAID" && payload.orderNumber && payload.paidAt) {
    const externalId = `order-${payload.orderNumber}`;

    // 返金済みの注文に、遅れて届いた決済通知で金額を戻さない
    const { data: existing } = await supabase
      .from("hightore_deposits")
      .select("memo")
      .eq("provider", "bluepay")
      .eq("external_id", externalId)
      .maybeSingle();
    if (existing?.memo?.startsWith("返金済み")) return new NextResponse(null, { status: 200 });

    const { error } = await supabase.from("hightore_deposits").upsert(
      {
        provider: "bluepay",
        external_id: externalId,
        deposit_date: toDate(payload.paidAt),
        amount: Number(payload.settlementAmount) || 0,
        memo: `${payload.currency || ""} 決済（決済額 ${payload.yenAmount}円 - 手数料 ${payload.fee}円）`.trim(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "provider,external_id" }
    );
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (event === "refund.completed" && payload.status === "COMPLETED" && payload.orderNumber) {
    const externalId = `order-${payload.orderNumber}`;
    const { data: updated, error } = await supabase
      .from("hightore_deposits")
      .update({ amount: 0, memo: `返金済み（${toDate(payload.finishAt || payload.createdAt)}）`, updated_at: new Date().toISOString() })
      .eq("provider", "bluepay")
      .eq("external_id", externalId)
      .select("id");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // 元の注文を取り込む前の返金は、返金日にマイナスで記録する
    if (!updated || updated.length === 0) {
      const { error: insertError } = await supabase.from("hightore_deposits").upsert(
        {
          provider: "bluepay",
          external_id: `refund-${payload.refundId}`,
          deposit_date: toDate(payload.finishAt || payload.createdAt),
          amount: -(Number(payload.yenAmount) || 0),
          memo: `返金（注文 ${payload.orderNumber}）`,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "provider,external_id" }
      );
      if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });
    }
  }

  // その他の通知（失敗・期限切れなど）は入金に関係しないので受け取るだけ
  return new NextResponse(null, { status: 200 });
}
