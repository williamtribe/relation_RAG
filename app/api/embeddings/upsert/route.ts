import { NextResponse } from "next/server";
import { openai } from "../../../../lib/openai";
import { supabaseAdmin } from "../../../../lib/db";

export async function POST(req: Request) {
  try {
    const { profile_id, intro } = await req.json();
    if (!profile_id || !intro) return NextResponse.json({ error: "missing" }, { status: 400 });

    const emb = await openai.embeddings.create({
      input: intro,
      model: "text-embedding-3-small", // 1536차원
    });
    const vector = emb.data[0].embedding;

    const { error } = await supabaseAdmin
      .from("profile_embeddings")
      .upsert({ profile_id, embedding: vector, updated_at: new Date().toISOString() });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}