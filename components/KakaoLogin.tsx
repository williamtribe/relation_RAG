"use client";
import { useEffect, useState } from "react";

interface KakaoUser {
  id: string;
  nickname?: string;
  profile_image?: string;
  email?: string;
}

export default function KakaoLogin() {
  const [user, setUser] = useState<KakaoUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUser();
  }, []);

  async function fetchUser() {
    try {
      const res = await fetch("/api/auth/me");
      const data = await res.json();
      setUser(data.user);
    } catch (error) {
      console.error("사용자 정보 가져오기 실패:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      setUser(null);
      window.location.reload();
    } catch (error) {
      console.error("로그아웃 실패:", error);
    }
  }

  if (loading) {
    return (
      <div style={{ padding: "8px 16px", fontSize: 14, color: "#6b7280" }}>
        로딩 중...
      </div>
    );
  }

  if (user) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {user.profile_image && (
          <img
            src={user.profile_image}
            alt={user.nickname || "프로필"}
            style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover" }}
          />
        )}
        <div style={{ fontSize: 14 }}>
          <div style={{ fontWeight: 600 }}>{user.nickname || "사용자"}</div>
          {user.email && (
            <div style={{ fontSize: 12, color: "#6b7280" }}>{user.email}</div>
          )}
        </div>
        <button
          onClick={handleLogout}
          style={{
            padding: "6px 12px",
            fontSize: 12,
            border: "1px solid #e5e7eb",
            borderRadius: 6,
            background: "white",
            cursor: "pointer",
          }}
        >
          로그아웃
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => {
        window.location.href = "/api/auth/kakao";
      }}
      style={{
        padding: "8px 16px",
        fontSize: 14,
        border: "none",
        borderRadius: 6,
        background: "#FEE500",
        color: "#000000",
        fontWeight: 600,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: 6,
      }}
    >
      <span>카카오 로그인</span>
    </button>
  );
}

