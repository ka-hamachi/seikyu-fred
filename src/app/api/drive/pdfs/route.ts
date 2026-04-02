import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";

export async function GET(req: NextRequest) {
  const accessToken = req.headers.get("x-google-token");
  const folderId = new URL(req.url).searchParams.get("folderId");

  if (!accessToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (!folderId) {
    return NextResponse.json({ error: "folderId required" }, { status: 400 });
  }

  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });

  const drive = google.drive({ version: "v3", auth });

  const res = await drive.files.list({
    q: `'${folderId}' in parents and mimeType = 'application/pdf' and trashed = false`,
    fields: "files(id, name, createdTime)",
    orderBy: "createdTime desc",
    pageSize: 50,
    includeItemsFromAllDrives: true,
    supportsAllDrives: true,
  });

  return NextResponse.json(res.data.files || []);
}
