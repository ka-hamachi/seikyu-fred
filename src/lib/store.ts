import fs from "fs";
import path from "path";
import type { SalesInvoice, PaymentInvoice, CreditPayment } from "@/types";

const DATA_DIR = path.join(process.cwd(), "data");

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readJson<T>(filename: string): T[] {
  ensureDataDir();
  const filePath = path.join(DATA_DIR, filename);
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, "[]", "utf-8");
    return [];
  }
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as T[];
}

function writeJson<T>(filename: string, data: T[]) {
  ensureDataDir();
  const filePath = path.join(DATA_DIR, filename);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
}

// Sales Invoices
export function getSalesInvoices(): SalesInvoice[] {
  return readJson<SalesInvoice>("sales-invoices.json");
}

export function saveSalesInvoices(invoices: SalesInvoice[]) {
  writeJson("sales-invoices.json", invoices);
}

// Payment Invoices
export function getPaymentInvoices(): PaymentInvoice[] {
  return readJson<PaymentInvoice>("payment-invoices.json");
}

export function savePaymentInvoices(invoices: PaymentInvoice[]) {
  writeJson("payment-invoices.json", invoices);
}

// Credit Payments
export function getCreditPayments(): CreditPayment[] {
  return readJson<CreditPayment>("credit-payments.json");
}

export function saveCreditPayments(payments: CreditPayment[]) {
  writeJson("credit-payments.json", payments);
}
