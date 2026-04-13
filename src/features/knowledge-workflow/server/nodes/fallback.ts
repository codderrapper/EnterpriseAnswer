import type { WorkflowState } from "../state";

export async function fallback(state: WorkflowState): Promise<Partial<WorkflowState>> {
  const message = state.finalAnswer ||
    `知识库中未找到与「${state.userQuestion}」足够相关的内容，请换个角度描述问题或补充文档后重试。`;
  return { finalAnswer: message };
}
