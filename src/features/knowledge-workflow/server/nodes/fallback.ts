import type { WorkflowState } from "../state";
import type { RunnableConfig } from "@langchain/core/runnables";
import type { WorkflowEvent } from "../events";

export async function fallback(
  state: WorkflowState,
  config?: RunnableConfig,
): Promise<Partial<WorkflowState>> {
  const send = config?.configurable?.send as ((e: WorkflowEvent) => void) | undefined;
  const requestId = config?.configurable?.requestId as string ?? "";

  send?.({ type: "data-node", ts: Date.now(), requestId, data: { node: "fallback", status: "running", ts: Date.now(), requestId } });

  const message = state.finalAnswer ||
    `知识库中未找到与「${state.userQuestion}」足够相关的内容，请换个角度描述问题或补充文档后重试。`;

  send?.({ type: "data-node", ts: Date.now(), requestId, data: { node: "fallback", status: "completed", ts: Date.now(), requestId } });
  return { finalAnswer: message };
}
