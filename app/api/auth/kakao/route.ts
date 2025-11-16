import { NextResponse } from "next/server";
import { encodeState, resolveRedirectTarget } from "@/lib/redirect";

const KAKAO_CLIENT_ID = process.env.KAKAO_CLIENT_ID!;
const KAKAO_REDIRECT_URI =
  process.env.KAKAO_REDIRECT_URI ||
  `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/auth/kakao/callback`;

export async function GET(request: Request) {
  if (!KAKAO_CLIENT_ID) {
    return NextResponse.json({ error: "KAKAO_CLIENT_ID가 설정되지 않았습니다." }, { status: 500 });
  }

  const url = new URL(request.url);
  const redirectTo = resolveRedirectTarget(url.searchParams.get("redirect_to"));
  const statePayload = redirectTo ? encodeState({ redirect_to: redirectTo }) : null;

  const authUrl = new URL("https://kauth.kakao.com/oauth/authorize");
  authUrl.searchParams.set("client_id", KAKAO_CLIENT_ID);
  authUrl.searchParams.set("redirect_uri", KAKAO_REDIRECT_URI);
  authUrl.searchParams.set("response_type", "code");
  if (statePayload) {
    authUrl.searchParams.set("state", statePayload);
  }

  return NextResponse.redirect(authUrl.toString());
}
