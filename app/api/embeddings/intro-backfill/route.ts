import { NextResponse } from "next/server";
import { openai } from "../../../../lib/openai";
import { supabaseAdmin } from "../../../../lib/db";
import { getPineconeIndex, type ProfileVectorMetadata } from "../../../../lib/pinecone";

type ProfileRow = {
  id: string;
  intro?: string | null;
};

const EMBEDDING_MODEL = "text-embedding-3-large";

const vectorId = (profileId: string) => `${profileId}:intro`;

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
    const limit = typeof body?.limit === "number" ? body.limit : 100;
    const force = Boolean(body?.force);

    // intro가 있는 모든 프로필 조회
    const { data: profiles, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id, intro")
      .not("intro", "is", null)
      .neq("intro", "");
    
    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }

    if (!profiles || profiles.length === 0) {
      return NextResponse.json({ processed: 0, remaining: 0, message: "No profiles with intro found" });
    }

    // 이미 임베딩된 프로필 확인 (force가 false인 경우)
    let targets = profiles;
    if (!force) {
      const { data: embeddings } = await supabaseAdmin
        .from("profile_embeddings")
        .select("profile_id")
        .not("embedding", "is", null);
      
      const existing = new Set((embeddings || []).map((row) => row.profile_id));
      targets = profiles.filter((p) => !existing.has(p.id));
    }

    const toProcess = targets.slice(0, limit);
    if (!toProcess.length) {
      return NextResponse.json({ 
        processed: 0, 
        remaining: targets.length,
        message: "All profiles already have embeddings" 
      });
    }

    // 배치 처리 (한 번에 10개씩)
    const batches = chunk(toProcess, 10);
    const pineconeIndex = getPineconeIndex();
    let processed = 0;
    let failed = 0;

    for (const batch of batches) {
      try {
        // intro 텍스트 추출 및 필터링
        const texts = batch
          .map((p) => trimOrNull(p.intro))
          .filter((text): text is string => text !== null);

        if (texts.length === 0) {
          continue;
        }

        // 임베딩 생성
        const embeddingsResponse = await openai.embeddings.create({
          model: EMBEDDING_MODEL,
          input: texts,
        });

        // Pinecone 벡터 준비
        const pineconeVectors: Array<{
          id: string;
          values: number[];
          metadata: ProfileVectorMetadata;
        }> = [];

        // Supabase에 저장할 데이터 준비
        const embeddingRows: Array<{
          profile_id: string;
          embedding: number[] | null;
          updated_at: string;
        }> = [];

        let textIdx = 0;
        for (const profile of batch) {
          const introText = trimOrNull(profile.intro);
          if (introText && textIdx < embeddingsResponse.data.length) {
            const embedding = embeddingsResponse.data[textIdx].embedding;
            
            // Pinecone 벡터 추가
            pineconeVectors.push({
              id: vectorId(profile.id),
              values: embedding,
              metadata: {
                profile_id: profile.id,
                vector_type: "intro",
              },
            });

            // Supabase 저장용 데이터 추가
            embeddingRows.push({
              profile_id: profile.id,
              embedding: embedding,
              updated_at: new Date().toISOString(),
            });

            textIdx++;
          } else {
            // intro가 없는 경우 null로 저장
            embeddingRows.push({
              profile_id: profile.id,
              embedding: null,
              updated_at: new Date().toISOString(),
            });
          }
        }

        // Supabase에 임베딩 저장
        const { error: upsertError } = await supabaseAdmin
          .from("profile_embeddings")
          .upsert(embeddingRows, { onConflict: "profile_id" });

        if (upsertError) {
          console.error("Supabase upsert error:", upsertError);
          failed += batch.length;
          continue;
        }

        // Pinecone에 업로드
        if (pineconeVectors.length > 0) {
          await pineconeIndex.upsert(pineconeVectors);
        }

        processed += batch.length;
      } catch (batchError: any) {
        console.error("Batch processing error:", batchError);
        failed += batch.length;
      }
    }

    return NextResponse.json({
      processed,
      failed,
      remaining: Math.max(targets.length - processed, 0),
      total: profiles.length,
    });
  } catch (err: any) {
    console.error("Intro backfill error:", err);
    return NextResponse.json({ error: err?.message || "failed" }, { status: 500 });
  }
}

