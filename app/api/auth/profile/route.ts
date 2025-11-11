import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/db";

export async function GET() {
  const kakaoUser = await getSession();
  if (!kakaoUser) {
    return NextResponse.json({ profile: null }, { status: 200 });
  }

  // 카카오 사용자 ID로 프로필 찾기 (kakao_id 컬럼 사용)
  const { data: profile, error } = await supabaseAdmin
    .from("profiles")
    .select("*")
    .eq("kakao_id", kakaoUser.id)
    .single();

  if (error && error.code !== "PGRST116") {
    // PGRST116은 "no rows returned" 에러
    // kakao_id 컬럼이 없을 수 있으므로 name으로 fallback 시도
    const { data: fallbackProfile } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("name", kakaoUser.nickname || "")
      .single();
    
    return NextResponse.json({ profile: fallbackProfile || null });
  }

  return NextResponse.json({ profile: profile || null });
}

