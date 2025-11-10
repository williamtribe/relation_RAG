import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/db";

export async function POST(req: Request) {
  const { profile_id, limit = 6 } = await req.json();
  if (!profile_id) return NextResponse.json({ error: "missing" }, { status: 400 });

  const { data: me } = await supabaseAdmin
    .from("profile_embeddings")
    .select("embedding")
    .eq("profile_id", profile_id)
    .single();
  if (!me?.embedding) return NextResponse.json({ data: [] });

  const { data, error } = await supabaseAdmin.rpc("match_profiles", {
    query_embedding: me.embedding,
    match_count: limit + 1,
    exclude_profile_id: profile_id
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data: (data || []).slice(0, limit) });
}