import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * 从已登录用户的 session 解析其所属 workspace_id。
 * 通过 user_workspace_mapping 实现 B2B 多租户：一个用户属于一个 workspace，
 * 所有数据隔离都以 workspace_id 为边界。
 */
export async function resolveWorkspaceId(supabase: SupabaseClient): Promise<string> {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("Unauthenticated");

  const { data, error } = await supabase
    .from("user_workspace_mapping")
    .select("workspace_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (error || !data) {
    throw new Error("No workspace found for this user. Ask your admin to add you to a workspace.");
  }
  return data.workspace_id as string;
}
