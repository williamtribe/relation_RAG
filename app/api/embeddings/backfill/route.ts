import { NextResponse } from "next/server";
import { openai } from "../../../../lib/openai";
import { supabaseAdmin } from "../../../../lib/db";
import { getPineconeIndex, type ProfileVectorMetadata } from "../../../../lib/pinecone";

type ProfileRow = {
  id: string;
  intro?: string | null;
  work?: string | null;
  hobby?: string | null;
  updated_at?: string | null;
};
type VectorType = ProfileVectorMetadata["vector_type"];

const EMBEDDING_MODEL = "text-embedding-3-large";

const vectorId = (profileId: string, type: VectorType) => `${profileId}:${type}`;

const trimOrNull = (value?: string | null) => {
  const trimmed = (value || "").trim();
  return trimmed.length ? trimmed : null;
};

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
      .select("id,intro,work,hobby,updated_at")
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

    const hasAnyText = (profile?: ProfileRow | null) =>
      Boolean(trimOrNull(profile?.intro) || trimOrNull(profile?.work) || trimOrNull(profile?.hobby));

    const existing = new Set((embeddings || []).map((row) => row.profile_id));
    const targets = (profiles || []).filter(
      (p) => hasAnyText(p) && (force || !existing.has(p.id))
    );
    const toProcess = targets.slice(0, limit);
    if (!toProcess.length) {
      return NextResponse.json({ processed: 0, remaining: targets.length });
    }

    const batches = chunk(toProcess, 10);
    const pineconeIndex = getPineconeIndex();
    let processed = 0;
    for (const batch of batches) {
      const tasks: Array<{
        profile: ProfileRow;
        type: VectorType;
        text: string;
      }> = [];
      const deletions: string[] = [];

      for (const profile of batch) {
        const introOnly = trimOrNull(profile.intro);
        const workText = trimOrNull(profile.work);
        const hobbyText = trimOrNull(profile.hobby);
        const introText = [introOnly, workText, hobbyText].filter(Boolean).join(" ");

        if (introText) {
          tasks.push({ profile, type: "intro", text: introText });
        } else {
          deletions.push(vectorId(profile.id, "intro"));
        }

        if (workText) {
          tasks.push({ profile, type: "work", text: workText });
        } else {
          deletions.push(vectorId(profile.id, "work"));
        }

        if (hobbyText) {
          tasks.push({ profile, type: "hobby", text: hobbyText });
        } else {
          deletions.push(vectorId(profile.id, "hobby"));
        }
      }

      const embeddingMap = new Map<
        string,
        {
          intro?: number[];
          work?: number[];
          hobby?: number[];
        }
      >();
      const pineconeVectors: Array<{
        id: string;
        values: number[];
        metadata: ProfileVectorMetadata;
      }> = [];

      if (tasks.length) {
        const embeddingsResponse = await openai.embeddings.create({
          model: EMBEDDING_MODEL,
          input: tasks.map((task) => task.text),
        });

        tasks.forEach((task, idx) => {
          const values = embeddingsResponse.data[idx].embedding;
          const entry = embeddingMap.get(task.profile.id) || {};
          if (task.type === "intro") entry.intro = values;
          if (task.type === "work") entry.work = values;
          if (task.type === "hobby") entry.hobby = values;
          embeddingMap.set(task.profile.id, entry);

          pineconeVectors.push({
            id: vectorId(task.profile.id, task.type),
            values,
            metadata: {
              profile_id: task.profile.id,
              vector_type: task.type,
            },
          });
        });
      }

      const now = new Date().toISOString();
      const rows = batch.map((profile) => {
        const entry = embeddingMap.get(profile.id) || {};
        return {
          profile_id: profile.id,
          embedding: entry.intro ?? null,
          work_embedding: entry.work ?? null,
          hobby_embedding: entry.hobby ?? null,
          updated_at: now,
        };
      });

      const { error } = await supabaseAdmin.from("profile_embeddings").upsert(rows);
      if (error) {
        return NextResponse.json({ error: error.message, processed }, { status: 500 });
      }

      if (pineconeVectors.length) {
        await pineconeIndex.upsert(pineconeVectors);
      }
      if (deletions.length) {
        const uniqueDeletes = Array.from(new Set(deletions));
        await pineconeIndex.deleteMany(uniqueDeletes);
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
