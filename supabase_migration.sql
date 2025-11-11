-- Supabase profiles 테이블에 kakao_id 컬럼 추가
-- Supabase 대시보드의 SQL Editor에서 실행하거나 마이그레이션으로 실행하세요

-- kakao_id 컬럼 추가 (VARCHAR, NULL 허용)
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS kakao_id VARCHAR(255);

-- kakao_id에 인덱스 추가 (조회 성능 향상)
CREATE INDEX IF NOT EXISTS idx_profiles_kakao_id ON profiles(kakao_id);

-- 기존 데이터가 있다면 선택적으로 업데이트할 수 있습니다
-- UPDATE profiles SET kakao_id = 'your_kakao_id' WHERE id = 'profile_uuid';

