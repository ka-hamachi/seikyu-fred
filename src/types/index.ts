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
