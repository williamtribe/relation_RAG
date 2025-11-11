-- Supabase profile_embeddings 테이블에 work_embedding과 hobby_embedding 컬럼 추가
-- Supabase 대시보드의 SQL Editor에서 실행하세요

-- work_embedding 컬럼 추가 (일/직업 임베딩)
ALTER TABLE profile_embeddings 
ADD COLUMN IF NOT EXISTS work_embedding vector(1536);

-- hobby_embedding 컬럼 추가 (취미/관심사 임베딩)
ALTER TABLE profile_embeddings 
ADD COLUMN IF NOT EXISTS hobby_embedding vector(1536);

-- 참고:
-- - embedding: 전체 임베딩 (intro + work + hobby 합친 것)
-- - work_embedding: 일/직업만의 임베딩
-- - hobby_embedding: 취미/관심사만의 임베딩
-- - 모두 같은 모델(text-embedding-3-small)을 사용하며 1536차원입니다
-- - 클러스터링 시 work_embedding과 hobby_embedding을 각각 사용할 수 있습니다

