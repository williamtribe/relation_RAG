import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/db";
import { upsertProfileRow } from "../../../lib/sheets";

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function POST(req: Request) {
  const body = await req.json();
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .insert(body)
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await upsertProfileRow({
    id: data.id, name: data.name, company: data.company, role: data.role,
    intro: data.intro, tags: data.tags, updated_at: data.updated_at
  });

  return NextResponse.json({ data });
}
