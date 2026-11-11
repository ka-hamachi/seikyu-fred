import { WebStoreClient } from "@amazonpay/amazon-pay-api-sdk-nodejs";
import type { DepositProviderAdapter, FetchedDeposit } from "./types";

// Amazon Pay の決済グループ（2週間ごと、決済レポート1つ = 決済グループ1つ）ごとに、銀行へ送金される額を入金として取り込む
// 環境変数: AMAZON_PAY_PUBLIC_KEY_ID / AMAZON_PAY_PRIVATE_KEY（セラーセントラルのインテグレーションセントラルで作成するキーペア）
//
// レポート内の送金行（TransactionType = Transfer）は「1つ前の決済グループ」の送金で、次のレポートが出るまで現れない。
// そのため送金行は使わず、決済グループの明細（送金行以外）の NetTransactionAmount の合計＝送金額として、
// 期間終了直後（約2時間後）に送金されるので、期間終了の3時間後の日付を振込日として計上する。
// ※ 決済レポートはAmazon側に90日しか残らないため、それより前の入金は取得できない（毎日の自動同期で取りこぼしを防ぐ）

const SETTLEMENT_REPORT = "_GET_FLAT_FILE_OFFAMAZONPAYMENTS_SETTLEMENT_DATA_";
// 期間終了から送金の計上までの時間（実績は約2時間20分）
const TRANSFER_DELAY_MS = 3 * 60 * 60 * 1000;
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

interface AmazonPayReport {
  reportId: string;
  startTime?: string;
  endTime?: string;
  reportDocumentId?: string;
}

interface ReportList {
  reports?: AmazonPayReport[];
  nextToken?: string;
}

function createClient() {
  return new WebStoreClient({
    publicKeyId: process.env.AMAZON_PAY_PUBLIC_KEY_ID!,
    // Vercel の環境変数に1行で入れた場合の \n を改行に戻す
    privateKey: process.env.AMAZON_PAY_PRIVATE_KEY!.replace(/\\n/g, "\n"),
    region: "jp",
    algorithm: "AMZN-PAY-RSASSA-PSS-V2",
  });
}

// SDK（axios）のエラーから Amazon Pay のエラーメッセージを取り出す
function toError(err: unknown): Error {
  const data = (err as { response?: { data?: { reasonCode?: string; message?: string } } })?.response?.data;
  if (data?.reasonCode || data?.message) return new Error([data.reasonCode, data.message].filter(Boolean).join(": "));
  return err instanceof Error ? err : new Error(String(err));
}

// "20221118T150630Z" → ミリ秒（読めなければ null）
function parseCompactTime(value?: string): number | null {
  const m = value?.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
  return m ? Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) : null;
}

// "2026-10-29T22:43:43 +0900"（時刻とタイムゾーンの間にスペースあり）→ ミリ秒（読めなければ null）
function parseReportTime(value?: string): number | null {
  const ms = Date.parse((value || "").trim().replace(/\s*([+-]\d{2}):?(\d{2})$/, "$1:$2"));
  return Number.isNaN(ms) ? null : ms;
}

function toJstDate(ms: number): string {
  return new Date(ms + JST_OFFSET_MS).toISOString().slice(0, 10);
}

function decode(bytes: ArrayBuffer): string {
  const utf8 = new TextDecoder("utf-8").decode(bytes);
  return utf8.includes("�") ? new TextDecoder("shift-jis").decode(bytes) : utf8;
}

// 区切り文字（カンマ / タブ）で1行を分割する。ダブルクォート内の区切り文字は無視
function splitLine(line: string, delimiter: string): string[] {
  const cols: string[] = [];
  let current = "";
  let inQuotes = false;
  for (const ch of line) {
    if (ch === '"') inQuotes = !inQuotes;
    else if (ch === delimiter && !inQuotes) {
      cols.push(current.trim());
      current = "";
    } else current += ch;
  }
  cols.push(current.trim());
  return cols;
}

// 決済レポートから、決済グループIDと期間、送金額（送金行以外の明細の合計）を取り出す
function parseSettlement(text: string) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  const headerIndex = lines.findIndex((l) => l.includes("TransactionPostedDate") && l.includes("TransactionType"));
  if (headerIndex < 0) throw new Error("決済レポートの形式を読み取れませんでした");

  const delimiter = lines[headerIndex].includes("\t") ? "\t" : ",";

  // 明細の前にある "SettlementStartDate","…" などの見出し情報（JPの資料では SettlementEndData という綴りもある）
  const meta = Object.fromEntries(lines.slice(0, headerIndex).map((l) => splitLine(l, delimiter).slice(0, 2)));
  const startMs = parseReportTime(meta.SettlementStartDate);
  const endMs = parseReportTime(meta.SettlementEndDate || meta.SettlementEndData);

  const header = splitLine(lines[headerIndex], delimiter);
  const iType = header.indexOf("TransactionType");
  const iNet = header.indexOf("NetTransactionAmount");
  const iSettlement = header.indexOf("SettlementId");
  const iCurrency = header.indexOf("CurrencyCode");
  if (iNet < 0) throw new Error("決済レポートに NetTransactionAmount 列がありません");

  let settlementId = "";
  let net = 0;
  for (const line of lines.slice(headerIndex + 1)) {
    const cols = splitLine(line, delimiter);
    if (cols[iType] === "Transfer") continue;
    if (iCurrency >= 0 && cols[iCurrency] && cols[iCurrency] !== "JPY") {
      throw new Error(`円以外の取引があります: ${cols[iCurrency]}`);
    }
    settlementId ||= cols[iSettlement] || "";
    net += Number((cols[iNet] || "0").replace(/[^0-9.-]/g, "")) || 0;
  }

  return { settlementId, startMs, endMs, amount: Math.round(net) };
}

export const amazonPayAdapter: DepositProviderAdapter = {
  provider: "amazon_pay",

  isConfigured() {
    return Boolean(process.env.AMAZON_PAY_PUBLIC_KEY_ID && process.env.AMAZON_PAY_PRIVATE_KEY);
  },

  async fetchDeposits(from, to) {
    const client = createClient();

    // 作成済みの決済レポート（直近90日分）をすべて取得
    const reports: AmazonPayReport[] = [];
    try {
      let res = await client.getReports({ reportTypes: SETTLEMENT_REPORT, processingStatuses: "COMPLETED", pageSize: 100 });
      let list = res.data as ReportList;
      reports.push(...(list.reports || []));
      while (list.nextToken) {
        // nextToken は単独で指定する必要がある
        res = await client.getReports({ nextToken: list.nextToken });
        list = res.data as ReportList;
        reports.push(...(list.reports || []));
      }
    } catch (err) {
      throw toError(err);
    }

    // 振込日（期間終了の3時間後）が対象期間に入りそうなレポートだけ読む（前後2日の余裕を持たせる）
    const fromMs = Date.parse(`${from}T00:00:00+09:00`) - 2 * 86400000;
    const toMs = Date.parse(`${to}T00:00:00+09:00`) + 2 * 86400000;
    const targets = reports.filter((r) => {
      const end = parseCompactTime(r.endTime);
      return r.reportDocumentId && (end === null || (end + TRANSFER_DELAY_MS >= fromMs && end + TRANSFER_DELAY_MS < toMs));
    });

    const deposits: FetchedDeposit[] = [];
    for (const report of targets) {
      let url: string;
      try {
        const res = await client.getReportDocument(report.reportDocumentId!);
        url = (res.data as { url: string }).url;
      } catch (err) {
        throw toError(err);
      }

      // ダウンロードURLの有効期限は30秒なので、取得したらすぐに読む
      const fileRes = await fetch(url, { cache: "no-store" });
      if (!fileRes.ok) throw new Error(`決済レポートのダウンロードに失敗しました (HTTP ${fileRes.status})`);

      const s = parseSettlement(decode(await fileRes.arrayBuffer()));
      const endMs = s.endMs ?? parseCompactTime(report.endTime);
      if (endMs === null) throw new Error(`決済レポートの期間を読み取れませんでした (${report.reportId})`);

      // 合計が0以下の決済グループは送金されず、次の決済グループに繰り越される
      if (s.amount <= 0) continue;

      const depositDate = toJstDate(endMs + TRANSFER_DELAY_MS);
      if (depositDate < from || depositDate >= to) continue;

      const startMs = s.startMs ?? parseCompactTime(report.startTime);
      const period = startMs !== null ? `${toJstDate(startMs).slice(5)}〜${toJstDate(endMs).slice(5)}` : "";
      deposits.push({
        externalId: `settlement-${s.settlementId || report.reportId}`,
        depositDate,
        amount: s.amount,
        memo: `決済グループ ${s.settlementId}${period ? `（${period}）` : ""}`,
      });
    }

    return deposits;
  },
};
