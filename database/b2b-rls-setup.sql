-- 1. 创建 B2B 核心表：Workspaces (企业/团队)
CREATE TABLE IF NOT EXISTS public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamp with time zone default now()
);

-- 2. 创建 B2B 关系表：用户 <-> Workspace 映射表
CREATE TABLE IF NOT EXISTS public.user_workspace_mapping (
  user_id uuid not null, -- 注意：在实际系统中应 foreign key references auth.users(id)
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member')),
  created_at timestamp with time zone default now(),
  primary key (user_id, workspace_id)
);

-- 3. 开启 RLS
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_workspace_mapping ENABLE ROW LEVEL SECURITY;

-- 用户只能看到自己所在的 workspace mapping（resolveWorkspaceId 依赖此策略）
CREATE POLICY "Users can view own workspace mapping"
ON public.user_workspace_mapping FOR SELECT
USING (user_id = auth.uid());

-- 用户只能看到自己所在的 workspace
CREATE POLICY "Members can view own workspace"
ON public.workspaces FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_workspace_mapping
    WHERE workspace_id = workspaces.id
    AND user_id = auth.uid()
  )
);

-- 4. 重新定义 documents 和 document_chunks 的 RLS (基于映射表)
-- 先清除刚才的 B2C 策略
DROP POLICY IF EXISTS "Users can view their own documents" ON public.documents;
DROP POLICY IF EXISTS "Users can insert their own documents" ON public.documents;
DROP POLICY IF EXISTS "Users can view chunks of their documents" ON public.document_chunks;
DROP POLICY IF EXISTS "Users can insert chunks of their documents" ON public.document_chunks;

-- documents 读策略：只要用户在那个 workspace 里，就能读
CREATE POLICY "Members can view workspace documents" 
ON public.documents FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.user_workspace_mapping
    WHERE user_workspace_mapping.workspace_id = documents.workspace_id
    AND user_workspace_mapping.user_id = auth.uid()
  )
);

-- documents 写策略：只要用户在那个 workspace 里，就能写 (更严格的话可以限制 role='admin')
CREATE POLICY "Members can insert workspace documents" 
ON public.documents FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_workspace_mapping
    WHERE user_workspace_mapping.workspace_id = documents.workspace_id
    AND user_workspace_mapping.user_id = auth.uid()
  )
);

-- document_chunks 读策略
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

-- document_chunks 写策略
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