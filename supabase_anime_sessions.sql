-- 애니메이션 게임 세션 테이블
CREATE TABLE IF NOT EXISTS anime_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL UNIQUE,
  user_id TEXT,
  kakao_id TEXT,
  responses JSONB NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  top_candidate_id TEXT,
  top_candidate_title TEXT,
  top_candidate_score NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_anime_sessions_session_id ON anime_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_anime_sessions_user_id ON anime_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_anime_sessions_kakao_id ON anime_sessions(kakao_id);
CREATE INDEX IF NOT EXISTS idx_anime_sessions_created_at ON anime_sessions(created_at DESC);

-- RLS (Row Level Security) 정책 (필요시)
-- ALTER TABLE anime_sessions ENABLE ROW LEVEL SECURITY;

-- 사용자는 자신의 세션만 조회 가능
-- CREATE POLICY "Users can view their own sessions"
--   ON anime_sessions FOR SELECT
--   USING (auth.uid()::text = user_id OR auth.uid()::text = kakao_id);

