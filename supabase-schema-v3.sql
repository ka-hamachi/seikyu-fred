-- Supabase SQL Editor で実行してください

-- imported_pdfs に invoice_id カラム追加（どの請求書に対応するか）
ALTER TABLE imported_pdfs ADD COLUMN IF NOT EXISTS invoice_id UUID;
