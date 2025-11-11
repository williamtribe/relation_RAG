-- Supabase profiles 테이블에 hobby와 work 컬럼 추가
-- Supabase 대시보드의 SQL Editor에서 실행하세요

-- hobby 컬럼 추가 (취미/관심사 소개)
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS hobby TEXT;

-- work 컬럼 추가 (일/직업 소개)
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS work TEXT;

-- 참고:
-- - hobby: 취미, 관심사, 즐거운 이야기
-- - work: 업무, 직업, 일에 대한 이야기
-- - intro: 기타 소개 (기존 필드 유지)
-- - 임베딩은 work와 hobby를 합쳐서 생성됩니다

