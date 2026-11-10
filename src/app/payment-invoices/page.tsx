import PaymentInvoicesView from "@/components/PaymentInvoicesView";

export default function PaymentInvoicesPage() {
  return <PaymentInvoicesView title="支払い請求書" apiPath="/api/payment-invoices" folderType="payment" />;
}
