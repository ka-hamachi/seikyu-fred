import { createPaymentInvoiceHandlers } from "@/lib/payment-invoice-handlers";

export const { GET, POST, PUT, DELETE } = createPaymentInvoiceHandlers("hightore_payment_invoices");
