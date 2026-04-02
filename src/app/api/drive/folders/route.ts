import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";

export async function GET(req: NextRequest) {
  const accessToken = req.headers.get("x-google-token");
  const parentId = new URL(req.url).searchParams.get("parentId"); // null = root level
  const driveId = new URL(req.url).searchParams.get("driveId"); // for shared drives

  if (!accessToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  const drive = google.drive({ version: "v3", auth });

  // Root level: show "My Drive" + shared drives
  if (!parentId) {
    const drives: { id: string; name: string; type: "my" | "shared" }[] = [];

    // My Drive
    const about = await drive.about.get({ fields: "user" });
    drives.push({
      id: "root",
      name: `マイドライブ (${about.data.user?.emailAddress || ""})`,
      type: "my",
    });

    // Shared Drives
    const sharedRes = await drive.drives.list({ pageSize: 50 });
    for (const sd of sharedRes.data.drives || []) {
      drives.push({
        id: sd.id!,
        name: sd.name!,
        type: "shared",
      });
    }

    return NextResponse.json({ drives, folders: [] });
  }

  // Sub-folder level: list folders inside parentId
  const params: Record<string, unknown> = {
    q: `'${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: "files(id, name)",
    orderBy: "name",
    pageSize: 100,
    includeItemsFromAllDrives: true,
    supportsAllDrives: true,
  };

  if (driveId && driveId !== "root") {
    params.driveId = driveId;
    params.corpora = "drive";
  }

  const res = await drive.files.list(params);

  return NextResponse.json({
    drives: [],
    folders: (res.data.files || []).map((f) => ({
      id: f.id!,
      name: f.name!,
    })),
  });
}
