-- Supabase SQL Editor で実行してください

-- 売上請求書テーブル
CREATE TABLE sales_invoices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client TEXT NOT NULL DEFAULT '',
  amount INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'paid')),
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  pdf_file_name TEXT,
  memo TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 支払い請求書テーブル
CREATE TABLE payment_invoices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client TEXT NOT NULL DEFAULT '',
  amount INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'paid')),
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  pdf_file_name TEXT,
  memo TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- クレジット支払いテーブル
CREATE TABLE credit_payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  description TEXT NOT NULL DEFAULT '',
  amount INTEGER NOT NULL DEFAULT 0,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  category TEXT,
  memo TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS (Row Level Security) を無効化（個人利用のため）
ALTER TABLE sales_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_payments ENABLE ROW LEVEL SECURITY;

-- 全アクセス許可ポリシー（個人利用）
CREATE POLICY "Allow all access" ON sales_invoices FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON payment_invoices FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON credit_payments FOR ALL USING (true) WITH CHECK (true);
