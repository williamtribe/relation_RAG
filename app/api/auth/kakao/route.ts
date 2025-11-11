import { NextResponse } from "next/server";

const KAKAO_CLIENT_ID = process.env.KAKAO_CLIENT_ID!;
const KAKAO_REDIRECT_URI = process.env.KAKAO_REDIRECT_URI || `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/auth/kakao/callback`;

export async function GET() {
  if (!KAKAO_CLIENT_ID) {
    return NextResponse.json({ error: "KAKAO_CLIENT_ID가 설정되지 않았습니다." }, { status: 500 });
  }

  // 카카오 로그인 URL 생성 (스코프는 동의항목 설정에서 관리)
  const authUrl = `https://kauth.kakao.com/oauth/authorize?client_id=${KAKAO_CLIENT_ID}&redirect_uri=${encodeURIComponent(KAKAO_REDIRECT_URI)}&response_type=code`;
  
  return NextResponse.redirect(authUrl);
}

