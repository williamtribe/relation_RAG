import { NextResponse } from "next/server";
import { openai } from "../../../../lib/openai";
import { supabaseAdmin } from "../../../../lib/db";

export async function POST(req: Request) {
  try {
    const { profile_id, intro, work, hobby } = await req.json();
    if (!profile_id) return NextResponse.json({ error: "profile_id required" }, { status: 400 });

    const updates: any = { profile_id, updated_at: new Date().toISOString() };

    // 전체 임베딩 (intro + work + hobby 합친 것)
    const combinedText = [intro, work, hobby].filter(Boolean).join(" ");
    if (combinedText) {
      const emb = await openai.embeddings.create({
        input: combinedText,
        model: "text-embedding-3-small", // 1536차원
      });
      updates.embedding = emb.data[0].embedding;
    }

    // 일/직업 임베딩 (별도)
    if (work && work.trim()) {
      const workEmb = await openai.embeddings.create({
        input: work.trim(),
        model: "text-embedding-3-small",
      });
      updates.work_embedding = workEmb.data[0].embedding;
    } else {
      updates.work_embedding = null;
    }

    // 취미/관심사 임베딩 (별도)
    if (hobby && hobby.trim()) {
      const hobbyEmb = await openai.embeddings.create({
        input: hobby.trim(),
        model: "text-embedding-3-small",
      });
      updates.hobby_embedding = hobbyEmb.data[0].embedding;
    } else {
      updates.hobby_embedding = null;
    }

    const { error } = await supabaseAdmin
      .from("profile_embeddings")
      .upsert(updates);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}