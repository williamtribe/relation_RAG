do $$
begin
  create type founder_dimension as enum ('vision', 'drive', 'team', 'execution');
exception
  when duplicate_object then null;
end $$;

create extension if not exists vector;

create table if not exists founder_question_bank (
  id text primary key,
  prompt text not null,
  dimension founder_dimension not null,
  polarity smallint not null check (polarity in (-1, 1)),
  weight numeric not null default 1,
  tags text[]
);

create table if not exists founder_swipe_sessions (
  id uuid primary key default gen_random_uuid(),
  deck_version text not null,
  question_count integer not null,
  participant_name text,
  kakao_id text,
  status text not null default 'in_progress',
  profile_code text,
  archetype_id text,
  dimension_scores jsonb,
  answer_vector vector(20),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists founder_swipe_answers (
  id bigint generated always as identity primary key,
  session_id uuid not null references founder_swipe_sessions(id) on delete cascade,
  question_id text not null references founder_question_bank(id) on delete cascade,
  answer_value boolean not null,
  duration_ms integer,
  dimension founder_dimension not null,
  polarity smallint not null check (polarity in (-1, 1)),
  weight numeric not null default 1,
  recorded_at timestamptz not null default now()
);

create index if not exists founder_swipe_answers_session_idx on founder_swipe_answers (session_id);
create index if not exists founder_swipe_sessions_kakao_idx on founder_swipe_sessions (kakao_id);

insert into founder_question_bank (id, prompt, dimension, polarity, weight, tags)
values
  ('q1', '3년 안에 글로벌 시장을 가정하고 제품을 설계한다.', 'vision', 1, 1.2, array['moonshot','strategy']),
  ('q2', '시장 반응이 확실해질 때까지 출시를 미룬 적이 있다.', 'vision', -1, 1, array['risk','validation']),
  ('q3', '투자를 받을 때, 성장 스토리보다 단위 경제성을 먼저 보여준다.', 'vision', -1, 0.9, array['finance']),
  ('q4', '제품 로드맵에 ''세상을 뒤집을 실험''이 항상 들어있다.', 'vision', 1, 1.1, array['product']),
  ('q5', '규모보다 생존 확률이 더 중요한 시기가 있었다.', 'vision', -1, 0.8, array['resilience']),
  ('q6', '새 기능을 생각하면 일단 ''언제까지 만들지''부터 정한다.', 'drive', 1, 1.1, array['cadence']),
  ('q7', '팀 속도를 위해 품질 기준을 과감히 낮춘 경험이 많다.', 'drive', 1, 1, array['tradeoff']),
  ('q8', '하루를 캘린더/업무 툴 없이 보내면 불안하다.', 'drive', -1, 1, array['ritual']),
  ('q9', '빠르게 달리는 대신 갈아엎는 리스크를 줄이는 편이다.', 'drive', -1, 0.9, array['risk']),
  ('q10', '첫 시제품을 일주일 안에 보여준 경험이 있다.', 'drive', 1, 1.2, array['prototype']),
  ('q11', '팀 문화나 케어에 쓰는 시간이 매주 캘린더에 묶여 있다.', 'team', 1, 1, array['culture']),
  ('q12', '중요한 의사결정은 결국 내가 혼자 내리는 편이다.', 'team', -1, 1, array['ownership']),
  ('q13', '정보를 모두 공유하면 속도가 느려지므로 필터링한다.', 'team', -1, 0.9, array['communication']),
  ('q14', '외부 멘토나 커뮤니티에서 자주 인사이트를 얻는다.', 'team', 1, 0.9, array['community']),
  ('q15', '팀의 감정 온도를 수치화하거나 기록해 본 적이 있다.', 'team', 1, 1.1, array['health']),
  ('q16', '데이터가 없으면 결정을 미루고 싶어진다.', 'execution', -1, 1.1, array['data']),
  ('q17', '고객 피드백에 맞춰 스프린트 계획을 바로 바꾼다.', 'execution', 1, 1, array['agility']),
  ('q18', '사람보다 프로세스에 문제가 있다고 느낄 때가 많다.', 'execution', -1, 1, array['process']),
  ('q19', '예상치 못한 기회가 오면 계획을 틀어서라도 붙잡는다.', 'execution', 1, 1, array['opportunity']),
  ('q20', '장기 KPI를 매주 리뷰하며 쪼개는 시간을 확보한다.', 'execution', -1, 1.1, array['kpi'])
on conflict (id) do update
set prompt = excluded.prompt,
    dimension = excluded.dimension,
    polarity = excluded.polarity,
    weight = excluded.weight,
    tags = excluded.tags;

alter table founder_swipe_sessions enable row level security;
alter table founder_swipe_answers enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'founder_swipe_sessions' and policyname = 'allow founder session inserts'
  ) then
    create policy "allow founder session inserts"
      on founder_swipe_sessions
      for insert
      to anon
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'founder_swipe_sessions' and policyname = 'allow founder session reads'
  ) then
    create policy "allow founder session reads"
      on founder_swipe_sessions
      for select
      to anon
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'founder_swipe_sessions' and policyname = 'allow founder session updates'
  ) then
    create policy "allow founder session updates"
      on founder_swipe_sessions
      for update
      to anon
      using (true)
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'founder_swipe_answers' and policyname = 'allow founder answer inserts'
  ) then
    create policy "allow founder answer inserts"
      on founder_swipe_answers
      for insert
      to anon
      with check (true);
  end if;
end $$;
