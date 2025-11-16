-- 애니메이션 게임 애널리틱스 이벤트 테이블
CREATE TABLE IF NOT EXISTS anime_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  session_id TEXT NOT NULL,
  user_id TEXT,
  kakao_id TEXT,
  question_id TEXT,
  answer TEXT,
  response_ms INTEGER,
  swipe_direction TEXT,
  drop_position_x NUMERIC,
  drop_position_y NUMERIC,
  timestamp TIMESTAMPTZ NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_anime_analytics_session_id ON anime_analytics(session_id);
CREATE INDEX IF NOT EXISTS idx_anime_analytics_user_id ON anime_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_anime_analytics_kakao_id ON anime_analytics(kakao_id);
CREATE INDEX IF NOT EXISTS idx_anime_analytics_event_type ON anime_analytics(event_type);
CREATE INDEX IF NOT EXISTS idx_anime_analytics_timestamp ON anime_analytics(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_anime_analytics_question_id ON anime_analytics(question_id);

-- RLS (Row Level Security) 정책 (필요시)
-- ALTER TABLE anime_analytics ENABLE ROW LEVEL SECURITY;

-- 사용자는 자신의 이벤트만 조회 가능
-- CREATE POLICY "Users can view their own analytics"
--   ON anime_analytics FOR SELECT
--   USING (auth.uid()::text = user_id OR auth.uid()::text = kakao_id);

