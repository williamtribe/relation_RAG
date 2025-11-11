-- Supabase likes 테이블 생성
-- Supabase 대시보드의 SQL Editor에서 실행하세요

-- likes 테이블 생성 (없는 경우)
CREATE TABLE IF NOT EXISTS likes (
  liker_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  likee_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (liker_id, likee_id)
);

-- 인덱스 추가 (조회 성능 향상)
CREATE INDEX IF NOT EXISTS idx_likes_liker_id ON likes(liker_id);
CREATE INDEX IF NOT EXISTS idx_likes_likee_id ON likes(likee_id);

-- RLS (Row Level Security) 정책 설정 (필요한 경우)
-- ALTER TABLE likes ENABLE ROW LEVEL SECURITY;

-- 참고: profiles 테이블의 id가 UUID 타입이어야 합니다.
-- 만약 profiles 테이블의 id가 VARCHAR 타입이라면:
-- CREATE TABLE IF NOT EXISTS likes (
--   liker_id VARCHAR(255) NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
--   likee_id VARCHAR(255) NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
--   created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
--   PRIMARY KEY (liker_id, likee_id)
-- );

