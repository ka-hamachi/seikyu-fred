import { NextRequest, NextResponse } from "next/server";
import { google, drive_v3 } from "googleapis";
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

  // 2. Collect all invoice files (PDF + images) recursively + fetch existing DB records in parallel
  const driveFiles = new Map<string, { id: string; name: string; mimeType: string; sourceFolder: string }>();
  const errors: string[] = [];
  // 1つでもフォルダの読み込みに失敗したら、Driveの一覧が不完全なので削除判定は行わない
  let scanFailed = false;

  // nextPageTokenを辿って全件取得（一覧が途中で切れると未取得分が削除扱いになるため）
  async function listAllFiles(q: string, fields: string) {
    const files: drive_v3.Schema$File[] = [];
    let pageToken: string | undefined;
    do {
      const res = await drive.files.list({
        q,
        fields: `nextPageToken, files(${fields})`,
        pageSize: 1000,
        pageToken,
        includeItemsFromAllDrives: true,
        supportsAllDrives: true,
      });
      files.push(...(res.data.files || []));
      pageToken = res.data.nextPageToken || undefined;
    } while (pageToken);
    return files;
  }

  async function collectFiles(folderId: string, folderName: string) {
    // Fetch invoice files (PDF, PNG, JPEG, WEBP) and subfolders in parallel
    const [files, subfolders] = await Promise.all([
      listAllFiles(
        `'${folderId}' in parents and (mimeType = 'application/pdf' or mimeType = 'image/png' or mimeType = 'image/jpeg' or mimeType = 'image/webp') and trashed = false`,
        "id, name, mimeType"
      ),
      listAllFiles(
        `'${folderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
        "id, name"
      ),
    ]);

    for (const file of files) {
      driveFiles.set(file.id!, { id: file.id!, name: file.name!, mimeType: file.mimeType!, sourceFolder: folderName });
    }

    // Recurse subfolders in parallel
    await Promise.all(
      subfolders.map((sub) => collectFiles(sub.id!, sub.name!))
    );
  }

  // Run all folder scans + DB query in parallel
  const folderNames = linkedFolders.map((f) => f.folder_name);
  const [y, m] = month.split("-").map(Number);
  const nextMonth = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
  const [, existingResult] = await Promise.all([
    Promise.all(
      linkedFolders.map(async (folder) => {
        try {
          await collectFiles(folder.folder_id, folder.folder_name);
        } catch (err) {
          scanFailed = true;
          errors.push(`Folder ${folder.folder_name}: ${String(err)}`);
        }
      })
    ),
    supabase
      .from(tableName)
      .select("id, drive_file_id, source_folder")
      .not("drive_file_id", "is", null)
      .gte("issue_date", `${month}-01`)
      .lt("issue_date", nextMonth),
  ]);

  // 既存レコードが取れないと全ファイルを新規扱いして重複登録してしまうので中断
  if (existingResult.error) {
    return NextResponse.json({ error: existingResult.error.message }, { status: 500 });
  }

  const existingByDriveId = new Map(
    (existingResult.data || []).map((inv) => [inv.drive_file_id, inv.id])
  );

  // 3. Determine new and removed files
  const newDriveFiles: [string, { id: string; name: string; mimeType: string; sourceFolder: string }][] = [];
  for (const [driveFileId, file] of driveFiles) {
    if (!existingByDriveId.has(driveFileId)) {
      newDriveFiles.push([driveFileId, file]);
    }
  }

  const removedIds: string[] = [];
  if (!scanFailed) {
    for (const [driveFileId, invoiceId] of existingByDriveId) {
      if (!driveFiles.has(driveFileId)) {
        removedIds.push(invoiceId);
      }
    }
  }

  // 4. Add new files (download PDF + Gemini parse) in parallel
  const addResults = await Promise.all(
    newDriveFiles.map(async ([driveFileId, file]) => {
      let client = "";
      let amount = 0;

      try {
        const dlRes = await drive.files.get(
          { fileId: driveFileId, alt: "media", supportsAllDrives: true },
          { responseType: "arraybuffer" }
        );
        const buffer = new Uint8Array(dlRes.data as ArrayBuffer);
        const geminiResult = await parsePdfWithGemini(buffer, type === "sales" ? "sales" : "payment", file.mimeType);
        client = geminiResult.client;
        amount = geminiResult.amount;
      } catch (err) {
        console.error(`[sync] PDF parse error for ${file.name}:`, err);
      }

      if (!client) {
        client = extractClientFromFileName(file.name);
      }

      const { error: insertError } = await supabase.from(tableName).insert({
        client: client || file.name.replace(/\.(pdf|png|jpe?g|webp)$/i, ""),
        amount,
        status: "unpaid",
        issue_date: month + "-01",
        pdf_file_name: file.name,
        drive_file_id: driveFileId,
        source_folder: file.sourceFolder,
        memo: null,
      });

      if (insertError) {
        if (!insertError.message.includes("duplicate") && !insertError.message.includes("unique")) {
          errors.push(`Insert ${file.name}: ${insertError.message}`);
        }
        return false;
      }
      return true;
    })
  );

  const addedCount = addResults.filter(Boolean).length;

  // 5. Remove invoices whose PDF was deleted from Drive
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
    removalSkipped: scanFailed || undefined,
    errors: errors.length > 0 ? errors : undefined,
  });
}
