import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  const { data, error } = await supabase
    .from("payment_invoices")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const invoices = (data || []).map((row) => ({
    id: row.id,
    client: row.client,
    amount: row.amount,
    status: row.status,
    checkStatus: row.check_status || "unchecked",
    issueDate: row.issue_date,
    dueDate: row.due_date || "",
    pdfFileName: row.pdf_file_name || "",
    sourceFolder: row.source_folder || "",
    driveFileId: row.drive_file_id || "",
    memo: row.memo || "",
    createdAt: row.created_at,
  }));

  return NextResponse.json(invoices);
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  const { data, error } = await supabase
    .from("payment_invoices")
    .insert({
      client: body.client || "",
      amount: Number(body.amount) || 0,
      status: body.status || "unpaid",
      issue_date: body.issueDate || new Date().toISOString().split("T")[0],
      due_date: body.dueDate || null,
      pdf_file_name: body.pdfFileName || null,
      memo: body.memo || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const { id, ids, ...updates } = body;

  const dbUpdates: Record<string, unknown> = {};
  if (updates.client !== undefined) dbUpdates.client = updates.client;
  if (updates.amount !== undefined) dbUpdates.amount = Number(updates.amount);
  if (updates.status !== undefined) dbUpdates.status = updates.status;
  if (updates.issueDate !== undefined) dbUpdates.issue_date = updates.issueDate;
  if (updates.dueDate !== undefined) dbUpdates.due_date = updates.dueDate || null;
  if (updates.memo !== undefined) dbUpdates.memo = updates.memo;
  if (updates.checkStatus !== undefined) dbUpdates.check_status = updates.checkStatus;

  if (ids && Array.isArray(ids)) {
    const { error } = await supabase
      .from("payment_invoices")
      .update(dbUpdates)
      .in("id", ids);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, updated: ids.length });
  }

  const { data, error } = await supabase
    .from("payment_invoices")
    .update(dbUpdates)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const ids = searchParams.get("ids");

  if (ids) {
    const idList = ids.split(",").filter(Boolean);
    const { error } = await supabase.from("payment_invoices").delete().in("id", idList);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, deleted: idList.length });
  }

  if (!id) return NextResponse.json({ error: "id or ids required" }, { status: 400 });

  const { error } = await supabase.from("payment_invoices").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
