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
  try {
    const { liker_id, likee_id, on } = await req.json();
    if (!liker_id || !likee_id || typeof on !== "boolean") {
      return NextResponse.json({ error: "liker_id, likee_id and boolean on required" }, { status: 400 });
    }

    console.log("좋아요 요청:", { liker_id, likee_id, on });

    if (on) {
      // 좋아요 추가
      // 1. likes 테이블에 저장
      const { data, error } = await supabaseAdmin
        .from("likes")
        .upsert({ liker_id, likee_id }, { onConflict: "liker_id,likee_id" })
        .select();
      
      if (error) {
        console.error("좋아요 추가 실패:", error);
        return NextResponse.json({ error: error.message, details: error }, { status: 500 });
      }
      console.log("좋아요 추가 성공:", data);

      // 2. profiles 테이블의 likes 배열에 liker_id 추가
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("likes")
        .eq("id", likee_id)
        .single();

      const currentLikes = Array.isArray(profile?.likes) ? profile.likes : [];
      if (!currentLikes.includes(liker_id)) {
        const updatedLikes = [...currentLikes, liker_id];
        const { error: updateError } = await supabaseAdmin
          .from("profiles")
          .update({ likes: updatedLikes })
          .eq("id", likee_id);
        
        if (updateError) {
          console.error("프로필 likes 업데이트 실패:", updateError);
        }
      }
    } else {
      // 좋아요 제거
      // 1. likes 테이블에서 삭제
      const { data, error } = await supabaseAdmin
        .from("likes")
        .delete()
        .eq("liker_id", liker_id)
        .eq("likee_id", likee_id)
        .select();
      
      if (error) {
        console.error("좋아요 제거 실패:", error);
        return NextResponse.json({ error: error.message, details: error }, { status: 500 });
      }
      console.log("좋아요 제거 성공:", data);

      // 2. profiles 테이블의 likes 배열에서 liker_id 제거
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("likes")
        .eq("id", likee_id)
        .single();

      const currentLikes = Array.isArray(profile?.likes) ? profile.likes : [];
      const updatedLikes = currentLikes.filter((id: string) => id !== liker_id);
      
      const { error: updateError } = await supabaseAdmin
        .from("profiles")
        .update({ likes: updatedLikes })
        .eq("id", likee_id);
      
      if (updateError) {
        console.error("프로필 likes 업데이트 실패:", updateError);
      }
    }

    // 프로필 목록도 새로고침하도록 하기 위해 프로필 업데이트 후 응답
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("좋아요 API 에러:", error);
    return NextResponse.json({ error: error.message || "Unknown error" }, { status: 500 });
  }
}
