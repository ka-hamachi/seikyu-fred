-- v7: HighTore事業の入金売上テーブルを追加
-- Supabase SQL Editor で実行してください

-- 決済サービス（fincode / Amazon Pay / Stripe / BluePay）から銀行口座への入金
-- APIで取り込んだ入金は (provider, external_id) で重複を防ぐ。手動追加分は external_id = 'manual-...'
CREATE TABLE hightore_deposits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  provider TEXT NOT NULL CHECK (provider IN ('fincode', 'amazon_pay', 'stripe', 'bluepay')),
  external_id TEXT NOT NULL,          -- 各サービス側の入金ID
  deposit_date DATE NOT NULL,         -- 振込日（口座に入った日）
  amount BIGINT NOT NULL DEFAULT 0,   -- 入金額（円）
  memo TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (provider, external_id)
);

CREATE INDEX hightore_deposits_deposit_date_idx ON hightore_deposits (deposit_date);

GRANT ALL ON hightore_deposits TO anon, authenticated, service_role;

ALTER TABLE hightore_deposits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access" ON hightore_deposits FOR ALL USING (true) WITH CHECK (true);
