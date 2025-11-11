"use client";
import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import KakaoLogin from "../components/KakaoLogin";

const ProfileGrid = dynamic(() => import("../components/ProfileGrid"), {
  ssr: false,
});

export default function Page() {
  const [currentUserName, setCurrentUserName] = useState("");
  const [currentProfileId, setCurrentProfileId] = useState<string | null>(null);
  const [kakaoUser, setKakaoUser] = useState<{ id?: string; nickname?: string } | null>(null);

  useEffect(() => {
    // URL에서 에러 메시지 확인
    const urlParams = new URLSearchParams(window.location.search);
    const error = urlParams.get("error");
    if (error) {
      alert(error);
      // 에러 파라미터 제거
      window.history.replaceState({}, "", window.location.pathname);
    }

    // 카카오 로그인 사용자 정보 및 프로필 가져오기
    Promise.all([
      fetch("/api/auth/me").then((res) => res.json()),
      fetch("/api/auth/profile").then((res) => res.json()),
    ])
      .then(([authData, profileData]) => {
        if (authData.user) {
          setKakaoUser(authData.user);
          
          // Supabase 프로필이 있으면 프로필 ID를 직접 사용
          if (profileData.profile) {
            setCurrentProfileId(profileData.profile.id);
            setCurrentUserName(profileData.profile.name || authData.user.nickname || "");
          }
        }
      })
      .catch((err) => console.error("사용자 정보 가져오기 실패:", err));
  }, []);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h1 style={{ margin: 0 }}>낙성대 회동</h1>
        <KakaoLogin />
      </div>
      {!kakaoUser && (
        <div style={{ marginBottom: 24, padding: 16, background: "#fef3c7", border: "1px solid #fbbf24", borderRadius: 8 }}>
          <p style={{ margin: 0, fontSize: 14, color: "#92400e" }}>
            프로필을 수정하려면 카카오 로그인이 필요합니다.
          </p>
        </div>
      )}
      <ProfileGrid 
        currentUserName={currentUserName.trim()} 
        currentProfileId={currentProfileId}
      />
    </div>
  );
}
