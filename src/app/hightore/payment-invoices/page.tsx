import PaymentInvoicesView from "@/components/PaymentInvoicesView";

export default function HighTorePaymentInvoicesPage() {
  return (
    <PaymentInvoicesView
      title="【HighTore】支払い請求書"
      apiPath="/api/hightore/payment-invoices"
      folderType="hightore_payment"
    />
  );
}
