create table public.document_chunks (
  id bigint generated always as identity not null,
  document_id bigint null,
  content text not null,
  embedding public.vector null,
  constraint document_chunks_pkey primary key (id),
  constraint document_chunks_document_id_fkey foreign KEY (document_id) references documents (id) on delete CASCADE
) TABLESPACE pg_default;

create table public.documents (
  id bigint generated always as identity not null,
  name text not null,
  content text not null,
  created_at timestamp with time zone null default now(),
  constraint documents_pkey primary key (id)
) TABLESPACE pg_default;

create table public.run_history (
  id bigint generated always as identity not null,
  question text not null,
  answer text null,
  error_code text null,
  token_usage jsonb null,
  cost_usd numeric null,
  topk integer null,
  threshold double precision null,
  matched_count integer null,
  duration_ms integer null,
  request_id text null,
  ttfb_ms integer null,
  embedding_ms integer null,
  retrieve_ms integer null,
  llm_ms integer null,
  best_similarity double precision null,
  steps jsonb null,
  sources jsonb null,
  created_at timestamp with time zone null default now(),
  constraint run_history_pkey primary key (id)
) TABLESPACE pg_default;

函数方法是
match_documents
begin
  return query
  select
    dc.id          as chunk_id,
    dc.document_id as document_id,
    dc.content,
    1 - (dc.embedding <=> query_embedding) as similarity
  from document_chunks dc
  where 1 - (dc.embedding <=> query_embedding) > match_threshold
  order by dc.embedding <=> query_embedding
  limit match_count;
end;



-- Prompt 版本管理
create table if not exists public.prompt_templates (
  id bigint generated always as identity primary key,
  name text not null,
  version integer not null,
  content text not null,
  is_active boolean not null default false,
  created_at timestamp with time zone not null default now(),
  unique (name, version)
);

create index if not exists idx_prompt_templates_name_active
  on public.prompt_templates (name, is_active, version desc);

-- 回答质量反馈
create table if not exists public.answer_feedback (
  id bigint generated always as identity primary key,
  run_id bigint not null references public.run_history (id) on delete cascade,
  vote text not null check (vote in ('up', 'down')),
  is_hallucination boolean not null default false,
  note text null,
  created_at timestamp with time zone not null default now()
);

create index if not exists idx_answer_feedback_run_id
  on public.answer_feedback (run_id, created_at desc);
