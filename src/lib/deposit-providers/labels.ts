import type { DepositProvider } from "@/types";

// 画面に出す順番と表示名（クライアントからも使うので、APIキーを読む処理とは分けておく）
export const DEPOSIT_PROVIDERS: { id: DepositProvider; label: string }[] = [
  { id: "fincode", label: "fincode" },
  { id: "amazon_pay", label: "Amazon Pay" },
  { id: "stripe", label: "Stripe" },
  { id: "bluepay", label: "BluePay" },
];

export const DEPOSIT_PROVIDER_LABELS = Object.fromEntries(
  DEPOSIT_PROVIDERS.map((p) => [p.id, p.label])
) as Record<DepositProvider, string>;
