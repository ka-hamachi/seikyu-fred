import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { parsePdfWithGemini } from "@/lib/pdf-parser";

export async function POST(req: NextRequest) {
  const accessToken = req.headers.get("x-google-token");
  const { fileId, fileName, type } = await req.json();

  if (!accessToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (!fileId) {
    return NextResponse.json({ error: "fileId required" }, { status: 400 });
  }

  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  const drive = google.drive({ version: "v3", auth });

  try {
    const res = await drive.files.get(
      { fileId, alt: "media", supportsAllDrives: true },
      { responseType: "arraybuffer" }
    );

    const buffer = new Uint8Array(res.data as ArrayBuffer);
    const { client, amount } = await parsePdfWithGemini(buffer, type === "sales" ? "sales" : "payment");

    return NextResponse.json({
      client,
      amount,
      fileName: fileName || "",
    });
  } catch (err) {
    return NextResponse.json({
      client: "",
      amount: 0,
      fileName: fileName || "",
      error: String(err),
    });
  }
}
