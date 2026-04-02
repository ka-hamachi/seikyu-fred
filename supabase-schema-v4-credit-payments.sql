-- credit_payments テーブル再作成
-- 既存テーブルをドロップして新しいスキーマで作り直す

DROP TABLE IF EXISTS credit_payments;

CREATE TABLE credit_payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  store TEXT NOT NULL DEFAULT '',
  withdrawal NUMERIC(12,0) NOT NULL DEFAULT 0,
  deposit NUMERIC(12,0) NOT NULL DEFAULT 0,
  card_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLSを有効化（既存テーブルと同様）
ALTER TABLE credit_payments ENABLE ROW LEVEL SECURITY;

-- 全操作を許可するポリシー（開発用）
CREATE POLICY "Allow all operations on credit_payments"
  ON credit_payments FOR ALL
  USING (true)
  WITH CHECK (true);
