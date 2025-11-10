import { NextResponse } from "next/server";
import { openai } from "../../../../lib/openai";
import { supabaseAdmin } from "../../../../lib/db";

type ProfileRow = { id: string; intro?: string | null; updated_at?: string | null };

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const limit = typeof body?.limit === "number" ? body.limit : 20;
    const force = Boolean(body?.force);

    const { data: profiles, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id,intro,updated_at")
      .order("updated_at", { ascending: false });
    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }

    const { data: embeddings, error: embeddingsError } = await supabaseAdmin
      .from("profile_embeddings")
      .select("profile_id");
    if (embeddingsError) {
      return NextResponse.json({ error: embeddingsError.message }, { status: 500 });
    }

    const existing = new Set((embeddings || []).map((row) => row.profile_id));
    const targets = (profiles || []).filter(
      (p) => !!p.intro?.trim() && (force || !existing.has(p.id))
    );
    const toProcess = targets.slice(0, limit);
    if (!toProcess.length) {
      return NextResponse.json({ processed: 0, remaining: targets.length });
    }

    const batches = chunk(toProcess, 10);
    let processed = 0;
    for (const batch of batches) {
      const embeddingsResponse = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: batch.map((p) => p.intro as string),
      });

      const rows = batch.map((profile, idx) => ({
        profile_id: profile.id,
        embedding: embeddingsResponse.data[idx].embedding,
        updated_at: new Date().toISOString(),
      }));

      const { error } = await supabaseAdmin
        .from("profile_embeddings")
        .upsert(rows);
      if (error) {
        return NextResponse.json({ error: error.message, processed }, { status: 500 });
      }
      processed += batch.length;
    }

    return NextResponse.json({
      processed,
      remaining: Math.max(targets.length - processed, 0),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "failed" }, { status: 500 });
  }
}
