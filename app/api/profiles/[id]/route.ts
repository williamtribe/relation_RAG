import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/db";
import { upsertProfileRow } from "../../../../lib/sheets";
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const id = params?.id;
  if (!id) {
    return NextResponse.json({ error: "missing id" }, { status: 400 });
  }

  const patch = await req.json();
  if (!patch || typeof patch !== "object") {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await upsertProfileRow({
    id: data.id,
    name: data.name,
    company: data.company,
    role: data.role,
    intro: data.intro,
    tags: data.tags,
    updated_at: data.updated_at,
  });

  return NextResponse.json({ data });
}
