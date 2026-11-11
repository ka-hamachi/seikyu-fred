import { WebStoreClient } from "@amazonpay/amazon-pay-api-sdk-nodejs";
import type { DepositProviderAdapter, FetchedDeposit } from "./types";

// Amazon Pay の決済レポート（2週間ごとに自動作成）のうち、銀行口座への送金（TransactionType = Transfer）を入金として取り込む
// 環境変数: AMAZON_PAY_PUBLIC_KEY_ID / AMAZON_PAY_PRIVATE_KEY（セラーセントラルのインテグレーションセントラルで作成するキーペア）
// ※ 決済レポートはAmazon側に90日しか残らないため、それより前の入金は取得できない
// ※ レポートに振込日の列はなく、送金の計上日（TransactionPostedDate）を振込日として使う（口座着金はその数営業日後）

const SETTLEMENT_REPORT = "_GET_FLAT_FILE_OFFAMAZONPAYMENTS_SETTLEMENT_DATA_";

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

// "2026-10-29T13:43:43 +0000"（時刻とタイムゾーンの間にスペースあり）→ 日本時間の "2026-10-29"（読めなければ null）
function postedDateToJst(value: string): string | null {
  const ms = Date.parse(value.trim().replace(/\s*([+-]\d{2}):?(\d{2})$/, "$1:$2"));
  return Number.isNaN(ms) ? null : new Date(ms + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
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

// 決済レポートから送金（Transfer）の行を取り出す
function parseTransfers(text: string) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  const headerIndex = lines.findIndex((l) => l.includes("TransactionPostedDate") && l.includes("TransactionType"));
  if (headerIndex < 0) throw new Error("決済レポートの形式を読み取れませんでした");

  const delimiter = lines[headerIndex].includes("\t") ? "\t" : ",";
  const header = splitLine(lines[headerIndex], delimiter);
  const col = (name: string) => header.indexOf(name);
  const iDate = col("TransactionPostedDate");
  const iType = col("TransactionType");
  const iAmount = col("TransactionAmount");
  const iSettlement = col("SettlementId");
  const iTransaction = col("AmazonTransactionId");
  const iCurrency = col("CurrencyCode");
  if (iAmount < 0) throw new Error("決済レポートに TransactionAmount 列がありません");

  return lines.slice(headerIndex + 1).flatMap((line) => {
    const cols = splitLine(line, delimiter);
    if (cols[iType] !== "Transfer") return [];
    if (iCurrency >= 0 && cols[iCurrency] && cols[iCurrency] !== "JPY") {
      throw new Error(`円以外の送金があります: ${cols[iCurrency]}`);
    }
    return [{
      postedDate: postedDateToJst(cols[iDate] || ""),
      settlementId: cols[iSettlement] || "",
      transactionId: cols[iTransaction] || "",
      // 送金はレポート上マイナスで記載されるので絶対値にする
      amount: Math.abs(Math.round(Number((cols[iAmount] || "0").replace(/[^0-9.-]/g, "")) || 0)),
    }];
  });
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

    // 対象期間と重ならないレポートは読まない（日付のずれを考えて前後2日広げる）
    const fromMs = Date.parse(`${from}T00:00:00+09:00`) - 2 * 86400000;
    const toMs = Date.parse(`${to}T00:00:00+09:00`) + 2 * 86400000;
    const targets = reports.filter((r) => {
      const start = parseCompactTime(r.startTime);
      const end = parseCompactTime(r.endTime);
      return r.reportDocumentId && !(end !== null && end < fromMs) && !(start !== null && start > toMs);
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

      parseTransfers(decode(await fileRes.arrayBuffer())).forEach((t, i) => {
        if (!t.postedDate || t.postedDate < from || t.postedDate >= to) return;
        deposits.push({
          externalId: `${t.settlementId || report.reportId}-${t.transactionId || i}`,
          depositDate: t.postedDate,
          amount: t.amount,
          memo: t.settlementId ? `決済ID ${t.settlementId}` : null,
        });
      });
    }

    return deposits;
  },
};
