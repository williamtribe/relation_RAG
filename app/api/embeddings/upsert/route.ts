import { NextResponse } from "next/server";
import { openai } from "../../../../lib/openai";
import { supabaseAdmin } from "../../../../lib/db";
import { getPineconeIndex, type ProfileVectorMetadata } from "../../../../lib/pinecone";

const EMBEDDING_MODEL = "text-embedding-3-large"; // 3072차원
type VectorType = ProfileVectorMetadata["vector_type"];

const vectorId = (profileId: string, type: VectorType) => `${profileId}:${type}`;

const trimOrNull = (value?: string | null) => {
  const trimmed = (value || "").trim();
  return trimmed.length ? trimmed : null;
};

export async function POST(req: Request) {
  try {
    const { profile_id, intro, work, hobby } = await req.json();
    if (!profile_id) {
      return NextResponse.json({ error: "profile_id required" }, { status: 400 });
    }

    const pineconeIndex = getPineconeIndex();
    const updates: Record<string, any> = {
      profile_id,
      updated_at: new Date().toISOString(),
    };

    const pineconeVectors: Array<{
      id: string;
      values: number[];
      metadata: ProfileVectorMetadata;
    }> = [];
    const pineconeDeletes: string[] = [];

    const enqueueVector = (type: VectorType, values: number[]) => {
      pineconeVectors.push({
        id: vectorId(profile_id, type),
        values,
        metadata: {
          profile_id,
          vector_type: type,
        },
      });
    };

    const enqueueDelete = (type: VectorType) => {
      pineconeDeletes.push(vectorId(profile_id, type));
    };

    // intro + work + hobby 전체 텍스트
    const introText = trimOrNull(intro);
    const workText = trimOrNull(work);
    const hobbyText = trimOrNull(hobby);
    const combinedText = [introText, workText, hobbyText].filter(Boolean).join(" ");

    if (combinedText) {
      const emb = await openai.embeddings.create({
        input: combinedText,
        model: EMBEDDING_MODEL,
      });
      const values = emb.data[0].embedding;
      updates.embedding = values;
      enqueueVector("intro", values);
    } else {
      updates.embedding = null;
      enqueueDelete("intro");
    }

    if (workText) {
      const workEmb = await openai.embeddings.create({
        input: workText,
        model: EMBEDDING_MODEL,
      });
      const values = workEmb.data[0].embedding;
      updates.work_embedding = values;
      enqueueVector("work", values);
    } else {
      updates.work_embedding = null;
      enqueueDelete("work");
    }

    if (hobbyText) {
      const hobbyEmb = await openai.embeddings.create({
        input: hobbyText,
        model: EMBEDDING_MODEL,
      });
      const values = hobbyEmb.data[0].embedding;
      updates.hobby_embedding = values;
      enqueueVector("hobby", values);
    } else {
      updates.hobby_embedding = null;
      enqueueDelete("hobby");
    }

    const { error } = await supabaseAdmin.from("profile_embeddings").upsert(updates);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (pineconeVectors.length) {
      await pineconeIndex.upsert(pineconeVectors);
    }
    if (pineconeDeletes.length) {
      await pineconeIndex.deleteMany(pineconeDeletes);
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
