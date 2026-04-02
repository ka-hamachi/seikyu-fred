import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  const month = searchParams.get("month");

  let query = supabase.from("linked_folders").select("*").order("created_at", { ascending: false });
  if (type) query = query.eq("type", type);
  if (month) query = query.eq("month", month);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { data, error } = await supabase
    .from("linked_folders")
    .upsert(
      {
        folder_id: body.folderId,
        folder_name: body.folderName,
        folder_path: body.folderPath || null,
        drive_name: body.driveName || null,
        type: body.type,
        month: body.month,
      },
      { onConflict: "folder_id,type,month" }
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const { error } = await supabase.from("linked_folders").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
