-- Supabase profile_embeddings 테이블의 임베딩 컬럼을 3072차원(pgvector)으로 관리하기 위한 스크립트
-- Supabase 대시보드 SQL Editor에서 순서대로 실행하세요.

-- 0) pgvector 확장 설치(이미 설치되어 있다면 스킵됨)
CREATE EXTENSION IF NOT EXISTS vector;

-- 1) 기본 embedding 컬럼이 없다면 생성
ALTER TABLE profile_embeddings
ADD COLUMN IF NOT EXISTS embedding vector(3072);

-- 2) work_embedding, hobby_embedding 컬럼도 3072차원으로 생성
ALTER TABLE profile_embeddings 
ADD COLUMN IF NOT EXISTS work_embedding vector(3072);

ALTER TABLE profile_embeddings 
ADD COLUMN IF NOT EXISTS hobby_embedding vector(3072);

-- 3) 기존에 1536차원으로 생성되어 있었다면, 아래 ALTER 문으로 타입을 확장하세요.
--    (기존 데이터는 dimension이 맞지 않으므로 미리 백업하거나 삭제 후 다시 생성해야 합니다.)
ALTER TABLE profile_embeddings
ALTER COLUMN embedding TYPE vector(3072);

ALTER TABLE profile_embeddings
ALTER COLUMN work_embedding TYPE vector(3072);

ALTER TABLE profile_embeddings
ALTER COLUMN hobby_embedding TYPE vector(3072);

-- (필요 시) ALTER 전에 아래처럼 값을 NULL 로 비워 타입 변경 오류를 피할 수 있습니다:
-- UPDATE profile_embeddings SET embedding = NULL, work_embedding = NULL, hobby_embedding = NULL;

-- 참고
-- - 이제부터 text-embedding-3-large (3072차원)를 사용합니다.
-- - ALTER TYPE 이후에는 /api/embeddings/backfill 을 실행해 모든 임베딩을 다시 생성하세요.
