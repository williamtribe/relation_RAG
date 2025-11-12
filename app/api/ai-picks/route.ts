import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/db";

// 임베딩을 배열로 변환하는 헬퍼 함수
function parseEmbedding(embedding: any): number[] | null {
  if (!embedding) return null;
  if (Array.isArray(embedding)) return embedding;
  if (typeof embedding === 'string') {
    try {
      const parsed = JSON.parse(embedding);
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
  return null;
}

// 코사인 유사도 계산 함수
function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

export async function POST(req: Request) {
  const { profile_id, limit = 4 } = await req.json();
  if (!profile_id) return NextResponse.json({ error: "missing" }, { status: 400 });

  const { data: me } = await supabaseAdmin
    .from("profile_embeddings")
    .select("embedding, work_embedding, hobby_embedding")
    .eq("profile_id", profile_id)
    .single();
  
  if (!me) {
    console.log("프로필 임베딩을 찾을 수 없습니다:", profile_id);
    return NextResponse.json({ intro: [], work: [], hobby: [] });
  }

  // 임베딩 파싱
  const workEmbedding = parseEmbedding(me.work_embedding);
  const hobbyEmbedding = parseEmbedding(me.hobby_embedding);

  console.log("임베딩 상태:", {
    hasEmbedding: !!me.embedding,
    hasWorkEmbedding: !!workEmbedding,
    hasHobbyEmbedding: !!hobbyEmbedding,
    workEmbeddingLength: workEmbedding?.length,
    hobbyEmbeddingLength: hobbyEmbedding?.length,
    workEmbeddingType: typeof me.work_embedding,
    hobbyEmbeddingType: typeof me.hobby_embedding
  });

  const result: any = { intro: [], work: [], hobby: [] };

  // 1. 자기소개 기반 추천 (전체 임베딩)
  if (me.embedding) {
    const { data, error } = await supabaseAdmin.rpc("match_profiles", {
      query_embedding: me.embedding,
      match_count: limit + 1,
      exclude_profile_id: profile_id
    });
    if (!error && data) {
      result.intro = data.slice(0, limit);
    }
  }

  // 2. 일/직업 기반 추천 (work_embedding 컬럼을 직접 검색)
  if (workEmbedding && workEmbedding.length > 0) {
    try {
      // work_embedding 컬럼을 가진 프로필들 중에서 유사도 검색
      const { data: allWorkEmbeddings, error: fetchError } = await supabaseAdmin
        .from("profile_embeddings")
        .select("profile_id, work_embedding")
        .not("work_embedding", "is", null)
        .neq("profile_id", profile_id);
      
      if (fetchError) {
        console.error("일/직업 임베딩 조회 에러:", fetchError);
      } else {
        const count = allWorkEmbeddings?.length || 0;
        console.log(`일/직업 임베딩을 가진 프로필 수: ${count}`);
        if (count === 0) {
          console.log("⚠️ 다른 사용자들이 아직 일/직업을 입력하지 않았습니다. 추천을 받으려면 다른 사용자들도 일/직업을 입력해야 합니다.");
        }
        if (allWorkEmbeddings && allWorkEmbeddings.length > 0) {
          // 코사인 유사도 계산
          const similarities = allWorkEmbeddings
            .map((row: any) => {
              const rowEmbedding = parseEmbedding(row.work_embedding);
              if (!rowEmbedding) return null;
              const similarity = cosineSimilarity(workEmbedding, rowEmbedding);
              return { profile_id: row.profile_id, distance: 1 - similarity };
            })
            .filter((item: any) => item !== null)
            .sort((a: any, b: any) => a.distance - b.distance)
            .slice(0, limit);
          
          console.log(`일/직업 추천 결과: ${similarities.length}개`);
          result.work = similarities;
        }
      }
    } catch (err: any) {
      console.error("일/직업 추천 처리 에러:", err);
    }
  } else {
    console.log("work_embedding이 없거나 유효하지 않습니다.");
  }

  // 3. 취미/관심사 기반 추천 (hobby_embedding 컬럼을 직접 검색)
  if (hobbyEmbedding && hobbyEmbedding.length > 0) {
    try {
      // hobby_embedding 컬럼을 가진 프로필들 중에서 유사도 검색
      const { data: allHobbyEmbeddings, error: fetchError } = await supabaseAdmin
        .from("profile_embeddings")
        .select("profile_id, hobby_embedding")
        .not("hobby_embedding", "is", null)
        .neq("profile_id", profile_id);
      
      if (fetchError) {
        console.error("취미/관심사 임베딩 조회 에러:", fetchError);
      } else {
        const count = allHobbyEmbeddings?.length || 0;
        console.log(`취미/관심사 임베딩을 가진 프로필 수: ${count}`);
        if (count === 0) {
          console.log("⚠️ 다른 사용자들이 아직 취미/관심사를 입력하지 않았습니다. 추천을 받으려면 다른 사용자들도 취미/관심사를 입력해야 합니다.");
        }
        if (allHobbyEmbeddings && allHobbyEmbeddings.length > 0) {
          // 코사인 유사도 계산
          const similarities = allHobbyEmbeddings
            .map((row: any) => {
              const rowEmbedding = parseEmbedding(row.hobby_embedding);
              if (!rowEmbedding) return null;
              const similarity = cosineSimilarity(hobbyEmbedding, rowEmbedding);
              return { profile_id: row.profile_id, distance: 1 - similarity };
            })
            .filter((item: any) => item !== null)
            .sort((a: any, b: any) => a.distance - b.distance)
            .slice(0, limit);
          
          console.log(`취미/관심사 추천 결과: ${similarities.length}개`);
          result.hobby = similarities;
        }
      }
    } catch (err: any) {
      console.error("취미/관심사 추천 처리 에러:", err);
    }
  } else {
    console.log("hobby_embedding이 없거나 유효하지 않습니다.");
  }

  return NextResponse.json(result);
}