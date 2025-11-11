import { NextResponse } from "next/server";
import { setSession, KakaoUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/db";
import { upsertProfileRow } from "@/lib/sheets";

const KAKAO_CLIENT_ID = process.env.KAKAO_CLIENT_ID!;
const KAKAO_CLIENT_SECRET = process.env.KAKAO_CLIENT_SECRET!;
const KAKAO_REDIRECT_URI = process.env.KAKAO_REDIRECT_URI || `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/auth/kakao/callback`;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(new URL(`/?error=${encodeURIComponent(error)}`, request.url));
  }

  if (!code) {
    return NextResponse.redirect(new URL("/?error=인증 코드가 없습니다.", request.url));
  }

  if (!KAKAO_CLIENT_ID || !KAKAO_CLIENT_SECRET) {
    return NextResponse.redirect(new URL("/?error=카카오 설정이 완료되지 않았습니다.", request.url));
  }

  try {
    // 1. 인증 코드로 액세스 토큰 받기
    const tokenResponse = await fetch("https://kauth.kakao.com/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: KAKAO_CLIENT_ID,
        client_secret: KAKAO_CLIENT_SECRET,
        redirect_uri: KAKAO_REDIRECT_URI,
        code,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error("카카오 토큰 요청 실패:", errorData);
      return NextResponse.redirect(new URL("/?error=토큰 요청 실패", request.url));
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // 2. 액세스 토큰으로 사용자 정보 가져오기 (property_keys로 필요한 정보 요청)
    const userResponse = await fetch("https://kapi.kakao.com/v2/user/me?property_keys=[\"kakao_account.profile.nickname\",\"kakao_account.profile_image\",\"kakao_account.email\"]", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!userResponse.ok) {
      const errorData = await userResponse.json();
      console.error("카카오 사용자 정보 요청 실패:", errorData);
      return NextResponse.redirect(new URL("/?error=사용자 정보 요청 실패", request.url));
    }

    const userData = await userResponse.json();
    console.log("카카오 사용자 정보:", JSON.stringify(userData, null, 2));
    
    const kakaoId = String(userData.id);
    // 카카오 API 응답 구조에 따라 닉네임 추출 시도
    const nickname = userData.kakao_account?.profile?.nickname 
      || userData.kakao_account?.profile_nickname
      || userData.properties?.nickname
      || userData.nickname;
    
    const kakaoUser: KakaoUser = {
      id: kakaoId,
      nickname: nickname,
      profile_image: userData.kakao_account?.profile?.profile_image_url 
        || userData.properties?.profile_image,
      email: userData.kakao_account?.email,
    };
    
    console.log("추출된 카카오 사용자:", kakaoUser);

    // 3. Supabase에서 프로필 찾기 또는 생성
    const profileName = kakaoUser.nickname?.trim() || "카카오 사용자";
    
    // 3-1. kakao_id로 기존 프로필 찾기
    const { data: existingKakaoProfile } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("kakao_id", kakaoId)
      .single();

    let targetProfile = existingKakaoProfile;

    // 3-2. kakao_id로 찾지 못했고 이름이 있으면 이름으로 기존 프로필 찾기
    if (!targetProfile && profileName !== "카카오 사용자") {
      const { data: existingNameProfile } = await supabaseAdmin
        .from("profiles")
        .select("*")
        .eq("name", profileName)
        .is("kakao_id", null) // kakao_id가 없는 프로필만 찾기
        .single();

      if (existingNameProfile) {
        console.log("이름으로 기존 프로필 발견:", existingNameProfile);
        targetProfile = existingNameProfile;
        
        // 기존 프로필에 kakao_id 연결
        const { data: linkedProfile, error: linkError } = await supabaseAdmin
          .from("profiles")
          .update({
            kakao_id: kakaoId,
            avatar_url: kakaoUser.profile_image || existingNameProfile.avatar_url,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingNameProfile.id)
          .select("*")
          .single();

        if (linkError) {
          console.error("프로필 연결 실패:", linkError);
        } else if (linkedProfile) {
          targetProfile = linkedProfile;
          // Google Sheets에도 동기화
          await upsertProfileRow({
            id: linkedProfile.id,
            name: linkedProfile.name,
            company: linkedProfile.company || "",
            role: linkedProfile.role || "",
            intro: linkedProfile.intro || "",
            tags: linkedProfile.tags || [],
            updated_at: linkedProfile.updated_at,
          });
        }
      }
    }

    // 3-3. 프로필이 없으면 새로 생성
    if (!targetProfile) {
      console.log("새 프로필 생성:", { kakaoId, profileName });
      
      const { data: createdProfile, error: createError } = await supabaseAdmin
        .from("profiles")
        .insert({
          kakao_id: kakaoId,
          name: profileName,
          avatar_url: kakaoUser.profile_image,
          updated_at: new Date().toISOString(),
        })
        .select("*")
        .single();

      if (createError) {
        console.error("프로필 생성 실패:", createError);
      } else if (createdProfile) {
        targetProfile = createdProfile;
        // Google Sheets에도 동기화
        await upsertProfileRow({
          id: createdProfile.id,
          name: createdProfile.name,
          company: createdProfile.company || "",
          role: createdProfile.role || "",
          intro: createdProfile.intro || "",
          tags: createdProfile.tags || [],
          updated_at: createdProfile.updated_at,
        });
      }
    } else {
      // 3-4. 기존 프로필이 있으면 카카오 정보로 업데이트
      console.log("기존 프로필 업데이트:", targetProfile);
      
      const updates: any = { updated_at: new Date().toISOString() };
      
      // 프로필 이미지 업데이트
      if (kakaoUser.profile_image && targetProfile.avatar_url !== kakaoUser.profile_image) {
        updates.avatar_url = kakaoUser.profile_image;
      }
      
      // 이름이 "카카오 사용자"이면 카카오 닉네임으로 업데이트
      if (kakaoUser.nickname?.trim() && targetProfile.name === "카카오 사용자") {
        updates.name = kakaoUser.nickname.trim();
      }

      if (Object.keys(updates).length > 1) {
        const { data: updatedProfile, error: updateError } = await supabaseAdmin
          .from("profiles")
          .update(updates)
          .eq("id", targetProfile.id)
          .select("*")
          .single();

        if (updateError) {
          console.error("프로필 업데이트 실패:", updateError);
        } else if (updatedProfile) {
          await upsertProfileRow({
            id: updatedProfile.id,
            name: updatedProfile.name,
            company: updatedProfile.company || "",
            role: updatedProfile.role || "",
            intro: updatedProfile.intro || "",
            tags: updatedProfile.tags || [],
            updated_at: updatedProfile.updated_at,
          });
        }
      }
    }

    // 4. 세션 설정
    await setSession(kakaoUser);

    // 5. 메인 페이지로 리다이렉트
    return NextResponse.redirect(new URL("/", request.url));
  } catch (error: any) {
    console.error("카카오 로그인 처리 중 오류:", error);
    return NextResponse.redirect(new URL(`/?error=${encodeURIComponent(error.message || "로그인 실패")}`, request.url));
  }
}

