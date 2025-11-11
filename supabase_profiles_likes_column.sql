-- Supabase profiles 테이블에 likes 컬럼 추가
-- Supabase 대시보드의 SQL Editor에서 실행하세요

-- likes 컬럼 추가 (UUID 배열 타입)
-- 자신에게 좋아요를 누른 사람들의 프로필 ID를 저장
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS likes UUID[] DEFAULT '{}';

-- 인덱스 추가 (배열 검색 성능 향상)
CREATE INDEX IF NOT EXISTS idx_profiles_likes ON profiles USING GIN(likes);

-- 참고: 
-- - likes는 UUID 배열 타입입니다
-- - 기본값은 빈 배열 '{}'입니다
-- - GIN 인덱스를 사용하여 배열 검색 성능을 향상시킵니다

