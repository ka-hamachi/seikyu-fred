import type { DepositProvider } from "@/types";

// 各決済サービスから取得した、銀行口座への入金1件
export interface FetchedDeposit {
  externalId: string;
  depositDate: string; // 振込日（日本時間の YYYY-MM-DD）
  amount: number; // 入金額（円）
  memo?: string | null;
}

export interface DepositProviderAdapter {
  provider: DepositProvider;
  // 必要な環境変数がそろっているか
  isConfigured(): boolean;
  // 振込日が from 以上 to 未満（YYYY-MM-DD）の入金済みの入金を返す
  fetchDeposits(from: string, to: string): Promise<FetchedDeposit[]>;
}

const JST_OFFSET_SECONDS = 9 * 60 * 60;

// UNIX秒 → 日本時間の YYYY-MM-DD
export function unixToJstDate(unixSeconds: number): string {
  return new Date((unixSeconds + JST_OFFSET_SECONDS) * 1000).toISOString().slice(0, 10);
}

// YYYY-MM-DD（日本時間の0時）→ UNIX秒
export function jstDateToUnix(date: string): number {
  return Math.floor(Date.parse(`${date}T00:00:00+09:00`) / 1000);
}
