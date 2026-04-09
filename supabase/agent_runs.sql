create table if not exists agent_runs (
  id           bigserial primary key,
  question     text not null,
  active_query text,
  retry_count  int default 0,
  route        text,
  answer       text,
  graded_docs  jsonb,
  selected_docs jsonb,
  decision     jsonb,
  duration_ms  int,
  created_at   timestamptz default now()
);
