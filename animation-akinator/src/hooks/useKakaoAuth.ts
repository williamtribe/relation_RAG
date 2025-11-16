import { useCallback, useEffect, useMemo, useState } from "react";

export interface KakaoUser {
  id: string;
  nickname?: string;
  profile_image?: string;
  email?: string;
}

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "";

const withApiBase = (path: string) => {
  if (!API_BASE) return path;
  if (path.startsWith("http")) return path;
  return `${API_BASE.replace(/\/$/, "")}${path}`;
};

export function useKakaoAuth() {
  const [user, setUser] = useState<KakaoUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUser = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(withApiBase("/api/auth/me"), {
        credentials: "include"
      });
      if (!res.ok) {
        throw new Error(`사용자 정보를 불러오지 못했습니다. (${res.status})`);
      }
      const data = await res.json();
      setUser(data.user);
    } catch (err) {
      console.error("카카오 세션 확인 실패:", err);
      setError("세션 정보를 불러오지 못했습니다.");
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchUser();
  }, [fetchUser]);

  const login = useCallback(() => {
    const redirectTo = encodeURIComponent(window.location.href);
    window.location.href = withApiBase(`/api/auth/kakao?redirect_to=${redirectTo}`);
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch(withApiBase("/api/auth/logout"), {
        method: "POST",
        credentials: "include"
      });
      setUser(null);
    } catch (err) {
      console.error("카카오 로그아웃 실패:", err);
    } finally {
      void fetchUser();
    }
  }, [fetchUser]);

  return useMemo(
    () => ({
      user,
      loading,
      error,
      login,
      logout,
      refresh: fetchUser
    }),
    [user, loading, error, login, logout, fetchUser]
  );
}
