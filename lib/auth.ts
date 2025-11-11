import { cookies } from "next/headers";

export interface KakaoUser {
  id: string;
  nickname?: string;
  profile_image?: string;
  email?: string;
}

export async function getSession(): Promise<KakaoUser | null> {
  const cookieStore = await cookies();
  const sessionData = cookieStore.get("kakao_session");
  if (!sessionData?.value) return null;
  try {
    return JSON.parse(sessionData.value);
  } catch {
    return null;
  }
}

export async function setSession(user: KakaoUser) {
  const cookieStore = await cookies();
  cookieStore.set("kakao_session", JSON.stringify(user), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 7일
  });
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete("kakao_session");
}

