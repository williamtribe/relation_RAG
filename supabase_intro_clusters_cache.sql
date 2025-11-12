create table if not exists intro_cluster_cache (
  id text primary key,
  clusters jsonb not null,
  meta jsonb not null,
  source_updated_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists intro_cluster_cache_updated_at_idx
  on intro_cluster_cache (updated_at desc);
