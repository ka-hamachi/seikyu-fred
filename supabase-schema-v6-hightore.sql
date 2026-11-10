-- v6: HighTore事業の支払い請求書テーブルを追加
-- Supabase SQL Editor で実行してください

-- payment_invoices と同じ列・デフォルト値・制約・インデックスで作成
CREATE TABLE hightore_payment_invoices (LIKE payment_invoices INCLUDING ALL);

GRANT ALL ON hightore_payment_invoices TO anon, authenticated, service_role;

ALTER TABLE hightore_payment_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access" ON hightore_payment_invoices FOR ALL USING (true) WITH CHECK (true);

-- linked_folders.type に 'hightore_payment' を追加
-- (既存のtypeのCHECK制約を名前に関係なく削除してから作り直す)
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'linked_folders'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%type%'
  LOOP
    EXECUTE format('ALTER TABLE linked_folders DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE linked_folders ADD CONSTRAINT linked_folders_type_check
  CHECK (type IN ('sales', 'payment', 'hightore_payment'));
