-- Supabase SQL Editor で実行してください（追加テーブル）

-- 連携フォルダテーブル
CREATE TABLE linked_folders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  folder_id TEXT NOT NULL,
  folder_name TEXT NOT NULL,
  folder_path TEXT,
  drive_name TEXT,
  type TEXT NOT NULL CHECK (type IN ('sales', 'payment')),
  month TEXT NOT NULL,  -- e.g. "2026-04"
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(folder_id, type, month)
);

-- 取り込み済みPDFの記録（重複取り込み防止用）
CREATE TABLE imported_pdfs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  drive_file_id TEXT NOT NULL,
  folder_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('sales', 'payment')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(drive_file_id, type)
);

ALTER TABLE linked_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE imported_pdfs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access" ON linked_folders FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON imported_pdfs FOR ALL USING (true) WITH CHECK (true);
