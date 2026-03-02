/**
 * Demo 阶段的 workspaceId（不接登录前用）
 * ⭐ 面试亮点：通过配置化的“默认租户”，让系统在无登录条件下依然可演示
 */
export function getDemoWorkspaceIdOrThrow() {
  const ws = process.env.DEFAULT_WORKSPACE_ID;
  if (!ws) {
    throw new Error(
      "DEFAULT_WORKSPACE_ID missing. Set it in .env.local and restart dev server."
    );
  }
  return ws;
}