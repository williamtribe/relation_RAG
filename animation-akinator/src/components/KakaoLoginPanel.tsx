import type { KakaoUser } from "../hooks/useKakaoAuth";

interface Props {
  user: KakaoUser | null;
  loading: boolean;
  onLogin: () => void;
  onLogout: () => void;
}

export function KakaoLoginPanel({ user, loading, onLogin, onLogout }: Props) {
  if (loading) {
    return (
      <div className="kakao-panel loading">
        <span>카카오 세션 확인 중...</span>
      </div>
    );
  }

  if (user) {
    return (
      <div className="kakao-panel">
        <div className="kakao-user">
          {user.profile_image && (
            <img
              src={user.profile_image}
              alt={user.nickname ?? "프로필"}
              className="kakao-avatar"
              referrerPolicy="no-referrer"
            />
          )}
          <div>
            <p className="user-name">{user.nickname ?? "카카오 사용자"}</p>
            {user.email && <p className="user-email">{user.email}</p>}
          </div>
        </div>
        <button className="kakao-button secondary" onClick={onLogout}>
          로그아웃
        </button>
      </div>
    );
  }

  return (
    <button className="kakao-button primary" onClick={onLogin}>
      <span>카카오 로그인으로 빠르게 시작</span>
    </button>
  );
}
