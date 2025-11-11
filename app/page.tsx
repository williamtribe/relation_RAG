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
        <h1 style={{ margin: 0 }}>Relation RAG</h1>
        <KakaoLogin />
      </div>
      <div style={{ margin: "16px 0", display: "flex", gap: 12, flexWrap: "wrap" }}>
        <label style={{ fontSize: 14, flex: "1 1 280px" }}>
          내 이름
          <input
            value={currentUserName}
            onChange={(e) => setCurrentUserName(e.target.value)}
            placeholder="예: 홍길동"
            style={{ width: "100%", marginTop: 4, border: "1px solid #e5e7eb", borderRadius: 6, padding: 8 }}
          />
        </label>
        <p style={{ fontSize: 13, color: "#6b7280", maxWidth: 340 }}>
          {kakaoUser ? (
            <>카카오 로그인으로 자동 인식되었습니다. 이름을 수정하거나 프로필을 관리할 수 있습니다.</>
          ) : (
            <>입력한 이름과 프로필 목록을 매칭해 내 정보를 자동으로 찾거나 새 프로필을 만들 수 있습니다.</>
          )}
        </p>
      </div>
      <ProfileGrid 
        currentUserName={currentUserName.trim()} 
        currentProfileId={currentProfileId}
      />
    </div>
  );
}
