-- 幂等脚本：可重复执行，不会因为表或 policy 已存在而报错
-- 建议在 Supabase Dashboard → SQL Editor 中整段执行

-- 1. 建表（IF NOT EXISTS，已存在则跳过）
CREATE TABLE IF NOT EXISTS public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamp with time zone default now()
);

CREATE TABLE IF NOT EXISTS public.user_workspace_mapping (
  user_id uuid not null,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member')),
  created_at timestamp with time zone default now(),
  primary key (user_id, workspace_id)
);

-- 2. 开启 RLS（幂等）
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_workspace_mapping ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_chunks ENABLE ROW LEVEL SECURITY;

-- 3. user_workspace_mapping policies
DROP POLICY IF EXISTS "Users can view own workspace mapping" ON public.user_workspace_mapping;
CREATE POLICY "Users can view own workspace mapping"
ON public.user_workspace_mapping FOR SELECT
USING (user_id = auth.uid());

-- 4. workspaces policies
DROP POLICY IF EXISTS "Members can view own workspace" ON public.workspaces;
CREATE POLICY "Members can view own workspace"
ON public.workspaces FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_workspace_mapping
    WHERE workspace_id = workspaces.id
    AND user_id = auth.uid()
  )
);

-- 5. documents policies（先清除旧的 B2C 策略）
DROP POLICY IF EXISTS "Users can view their own documents" ON public.documents;
DROP POLICY IF EXISTS "Users can insert their own documents" ON public.documents;
DROP POLICY IF EXISTS "Members can view workspace documents" ON public.documents;
DROP POLICY IF EXISTS "Members can insert workspace documents" ON public.documents;

CREATE POLICY "Members can view workspace documents"
ON public.documents FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_workspace_mapping
    WHERE workspace_id = documents.workspace_id
    AND user_id = auth.uid()
  )
);

CREATE POLICY "Members can insert workspace documents"
ON public.documents FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_workspace_mapping
    WHERE workspace_id = documents.workspace_id
    AND user_id = auth.uid()
  )
);

-- 6. document_chunks policies（先清除旧的）
DROP POLICY IF EXISTS "Users can view chunks of their documents" ON public.document_chunks;
DROP POLICY IF EXISTS "Users can insert chunks of their documents" ON public.document_chunks;
DROP POLICY IF EXISTS "Members can view workspace chunks" ON public.document_chunks;
DROP POLICY IF EXISTS "Members can insert workspace chunks" ON public.document_chunks;

CREATE POLICY "Members can view workspace chunks"
ON public.document_chunks FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.documents d
    JOIN public.user_workspace_mapping m ON d.workspace_id = m.workspace_id
    WHERE d.id = document_chunks.document_id
    AND m.user_id = auth.uid()
  )
);

CREATE POLICY "Members can insert workspace chunks"
ON public.document_chunks FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.documents d
    JOIN public.user_workspace_mapping m ON d.workspace_id = m.workspace_id
    WHERE d.id = document_chunks.document_id
    AND m.user_id = auth.uid()
  )
);
