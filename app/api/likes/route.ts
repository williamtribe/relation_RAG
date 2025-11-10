import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/db";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const liker_id = searchParams.get("liker_id");

  if (!liker_id) {
    return NextResponse.json({ error: "liker_id required" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("likes")
    .select("likee_id")
    .eq("liker_id", liker_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ids: (data || []).map((row) => row.likee_id) });
}

export async function POST(req: Request) {
  const { liker_id, likee_id, on } = await req.json();
  if (!liker_id || !likee_id || typeof on !== "boolean") {
    return NextResponse.json({ error: "liker_id, likee_id and boolean on required" }, { status: 400 });
  }

  if (on) {
    const { error } = await supabaseAdmin
      .from("likes")
      .upsert({ liker_id, likee_id }, { onConflict: "liker_id,likee_id" });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  } else {
    const { error } = await supabaseAdmin
      .from("likes")
      .delete()
      .eq("liker_id", liker_id)
      .eq("likee_id", likee_id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
