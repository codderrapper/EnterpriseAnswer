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
  topk integer null,
  threshold double precision null,
  matched_count integer null,
  duration_ms integer null,
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

