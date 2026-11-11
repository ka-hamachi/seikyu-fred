export interface SalesInvoice {
  id: string;
  client: string;
  amount: number;
  status: "unpaid" | "paid";
  issueDate: string;
  dueDate: string;
  pdfFileName?: string;
  sourceFolder?: string;
  driveFileId?: string;
  memo?: string;
  createdAt: string;
}

export interface PaymentInvoice {
  id: string;
  client: string;
  amount: number;
  status: "unpaid" | "paid" | "not_required";
  checkStatus: "unchecked" | "checked";
  issueDate: string;
  dueDate: string;
  pdfFileName?: string;
  sourceFolder?: string;
  driveFileId?: string;
  memo?: string;
  createdAt: string;
}

// 連携フォルダの種別（Drive同期の取り込み先テーブルに対応）
export type LinkedFolderType = "sales" | "payment" | "hightore_payment";

export interface CreditPayment {
  id: string;
  store: string;
  transactionId: string;
  withdrawal: number;
  deposit: number;
  transactionDate: string;
  cardName: string;
  createdAt: string;
}

export interface DashboardSummary {
  totalSales: number;
  totalPayments: number;
  totalCredit: number;
  grossProfit: number;
  salesCount: number;
  paymentsCount: number;
  creditCount: number;
  unpaidSalesCount: number;
  unpaidPaymentsCount: number;
}

export interface HighToreDashboardSummary {
  totalDeposits: number;
  depositsByProvider: Record<DepositProvider, number>;
  totalPayments: number;
  paymentsCount: number;
  unpaidPaymentsAmount: number;
  unpaidPaymentsCount: number;
  uncheckedPaymentsCount: number;
  grossProfit: number;
}

// HighTore 入金売上の入金元
export type DepositProvider = "fincode" | "amazon_pay" | "stripe" | "bluepay";

export interface HighToreDeposit {
  id: string;
  provider: DepositProvider;
  externalId: string;
  depositDate: string;
  amount: number;
  memo: string;
  createdAt: string;
}

export interface DepositSyncResult {
  provider: DepositProvider;
  // csv: APIで取りに行けず、振込申請CSVで取り込むサービス（BluePay）
  status: "ok" | "not_configured" | "error" | "csv";
  count: number;
  error?: string;
}
