import { getSupabaseClient } from "@/lib/supabaseClient";

export const DEFAULT_SYSTEM_PROMPT = `你是一名企业知识问答助手，请根据提供的企业内部文档内容，用简洁、正式的中文回答问题。
如果文档中找不到答案，请直接回复：“文档中未提及相关信息。”，不要编造。`;

export type PromptTemplateRow = {
  id: number;
  name: string;
  version: number;
  content: string;
  is_active: boolean;
  created_at?: string;
};

export async function getPromptTemplateByVersion(version: number) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("prompt_templates")
    .select("id,name,version,content,is_active,created_at")
    .eq("version", version)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as PromptTemplateRow | null) ?? null;
}

export async function getActivePromptTemplate(name = "search_system") {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("prompt_templates")
    .select("id,name,version,content,is_active,created_at")
    .eq("name", name)
    .eq("is_active", true)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as PromptTemplateRow | null) ?? null;
}
