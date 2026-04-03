import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { supabase } from "@/lib/supabase";
import { parsePdfWithGemini, extractClientFromFileName } from "@/lib/pdf-parser";

export async function POST(req: NextRequest) {
  const accessToken = req.headers.get("x-google-token");
  if (!accessToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { type, month } = await req.json();
  if (!type || !month) {
    return NextResponse.json({ error: "type and month required" }, { status: 400 });
  }

  const tableName = type === "sales" ? "sales_invoices" : "payment_invoices";

  // 1. Get linked folders
  const { data: linkedFolders, error: foldersError } = await supabase
    .from("linked_folders")
    .select("*")
    .eq("type", type)
    .eq("month", month);

  if (foldersError) {
    return NextResponse.json({ error: foldersError.message }, { status: 500 });
  }
  if (!linkedFolders || linkedFolders.length === 0) {
    return NextResponse.json({ added: 0, removed: 0 });
  }

  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  const drive = google.drive({ version: "v3", auth });

  // 2. Collect all PDFs recursively from Drive folders (including subfolders)
  const driveFiles = new Map<string, { id: string; name: string; sourceFolder: string }>();
  const errors: string[] = [];

  async function collectPdfs(folderId: string, folderName: string) {
    // Get PDFs in this folder
    const pdfRes = await drive.files.list({
      q: `'${folderId}' in parents and mimeType = 'application/pdf' and trashed = false`,
      fields: "files(id, name)",
      pageSize: 1000,
      includeItemsFromAllDrives: true,
      supportsAllDrives: true,
    });
    for (const file of pdfRes.data.files || []) {
      driveFiles.set(file.id!, { id: file.id!, name: file.name!, sourceFolder: folderName });
    }

    // Get subfolders and recurse
    const folderRes = await drive.files.list({
      q: `'${folderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      fields: "files(id, name)",
      pageSize: 100,
      includeItemsFromAllDrives: true,
      supportsAllDrives: true,
    });
    for (const sub of folderRes.data.files || []) {
      await collectPdfs(sub.id!, sub.name!);
    }
  }

  for (const folder of linkedFolders) {
    try {
      await collectPdfs(folder.folder_id, folder.folder_name);
    } catch (err) {
      errors.push(`Folder ${folder.folder_name}: ${String(err)}`);
    }
  }

  // 3. Get existing auto-imported invoices only from the same source folders
  const folderNames = linkedFolders.map((f) => f.folder_name);
  const { data: existingInvoices } = await supabase
    .from(tableName)
    .select("id, drive_file_id, source_folder")
    .not("drive_file_id", "is", null)
    .in("source_folder", folderNames);

  const existingByDriveId = new Map(
    (existingInvoices || []).map((inv) => [inv.drive_file_id, inv.id])
  );

  // 4. Determine new and removed files
  const newDriveFiles: [string, { id: string; name: string; sourceFolder: string }][] = [];
  for (const [driveFileId, file] of driveFiles) {
    if (!existingByDriveId.has(driveFileId)) {
      newDriveFiles.push([driveFileId, file]);
    }
  }

  const removedIds: string[] = [];
  for (const [driveFileId, invoiceId] of existingByDriveId) {
    if (!driveFiles.has(driveFileId)) {
      removedIds.push(invoiceId);
    }
  }

  // Early return if nothing to do
  if (newDriveFiles.length === 0 && removedIds.length === 0) {
    return NextResponse.json({ added: 0, removed: 0 });
  }

  // 5. Add new files (download PDF + Gemini parse)
  let addedCount = 0;
  for (const [driveFileId, file] of newDriveFiles) {
    let client = "";
    let amount = 0;

    try {
      const dlRes = await drive.files.get(
        { fileId: driveFileId, alt: "media", supportsAllDrives: true },
        { responseType: "arraybuffer" }
      );
      const buffer = new Uint8Array(dlRes.data as ArrayBuffer);
      console.log(`[sync] Parsing PDF: ${file.name} (${buffer.length} bytes)`);
      const geminiResult = await parsePdfWithGemini(buffer, type === "sales" ? "sales" : "payment");
      console.log(`[sync] Gemini result for ${file.name}:`, geminiResult);
      client = geminiResult.client;
      amount = geminiResult.amount;
    } catch (err) {
      console.error(`[sync] PDF parse error for ${file.name}:`, err);
    }

    if (!client) {
      client = extractClientFromFileName(file.name);
    }

    const { error: insertError } = await supabase.from(tableName).insert({
      client: client || file.name.replace(".pdf", ""),
      amount,
      status: "unpaid",
      issue_date: month + "-01",
      pdf_file_name: file.name,
      drive_file_id: driveFileId,
      source_folder: file.sourceFolder,
      memo: amount === 0 ? "PDF解析 - 金額を確認してください" : "Google Driveから自動取り込み",
    });

    if (insertError) {
      if (!insertError.message.includes("duplicate") && !insertError.message.includes("unique")) {
        errors.push(`Insert ${file.name}: ${insertError.message}`);
      }
    } else {
      addedCount++;
    }
  }

  // 6. Remove invoices whose PDF was deleted from Drive
  let removedCount = 0;
  if (removedIds.length > 0) {
    const { error: delError } = await supabase.from(tableName).delete().in("id", removedIds);
    if (delError) {
      errors.push(`Bulk delete: ${delError.message}`);
    } else {
      removedCount = removedIds.length;
    }
  }

  return NextResponse.json({
    added: addedCount,
    removed: removedCount,
    errors: errors.length > 0 ? errors : undefined,
  });
}
