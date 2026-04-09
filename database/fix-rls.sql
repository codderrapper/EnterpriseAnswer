-- 1. 开启两张核心表的 RLS (行级安全策略)
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_chunks ENABLE ROW LEVEL SECURITY;

-- 2. 清除老策略
DROP POLICY IF EXISTS "Users can view their own documents" ON public.documents;
DROP POLICY IF EXISTS "Users can insert their own documents" ON public.documents;
DROP POLICY IF EXISTS "Users can view chunks of their documents" ON public.document_chunks;
DROP POLICY IF EXISTS "Users can insert chunks of their documents" ON public.document_chunks;

-- 3. 为 documents 表创建策略
-- 注意这里：直接把 workspace_id 和 auth.uid() 作为 UUID 类型比较
CREATE POLICY "Users can view their own documents" 
ON public.documents FOR SELECT 
USING (auth.uid() = workspace_id);

CREATE POLICY "Users can insert their own documents" 
ON public.documents FOR INSERT 
WITH CHECK (auth.uid() = workspace_id);

-- 4. 为 document_chunks 表创建策略
CREATE POLICY "Users can view chunks of their documents" 
ON public.document_chunks FOR SELECT 
USING (
  document_id IN (
    SELECT id FROM public.documents WHERE workspace_id = auth.uid()
  )
);

CREATE POLICY "Users can insert chunks of their documents" 
ON public.document_chunks FOR INSERT 
WITH CHECK (
  document_id IN (
    SELECT id FROM public.documents WHERE workspace_id = auth.uid()
  )
);