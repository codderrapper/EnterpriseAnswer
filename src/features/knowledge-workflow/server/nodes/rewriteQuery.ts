import type { WorkflowState } from "../state";
import type { RunnableConfig } from "@langchain/core/runnables";
import type { WorkflowEvent } from "../events";
import { rewriteForRetrieval } from "../services/rewrite";

export async function rewriteQuery(
  state: WorkflowState,
  config?: RunnableConfig,
): Promise<Partial<WorkflowState>> {
  const send = config?.configurable?.send as ((e: WorkflowEvent) => void) | undefined;
  const requestId = config?.configurable?.requestId as string ?? "";

  send?.({ type: "data-node", ts: Date.now(), requestId, data: { node: "rewriteQuery", status: "running", ts: Date.now(), requestId } });

  const { rewritten } = await rewriteForRetrieval(state.normalizedQuestion || state.userQuestion);

  send?.({ type: "data-node", ts: Date.now(), requestId, data: { node: "rewriteQuery", status: "completed", ts: Date.now(), requestId } });
  return {
    normalizedQuestion: rewritten,
    rewriteCount: (state.rewriteCount || 0) + 1,
  };
}
