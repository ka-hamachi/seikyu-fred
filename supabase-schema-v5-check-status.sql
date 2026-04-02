-- v5: payment_invoices に check_status カラムを追加
ALTER TABLE payment_invoices
  ADD COLUMN check_status TEXT NOT NULL DEFAULT 'unchecked'
  CHECK (check_status IN ('unchecked', 'checked'));
