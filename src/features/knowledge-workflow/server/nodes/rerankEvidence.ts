import type { WorkflowState } from "../state";
import type { RunnableConfig } from "@langchain/core/runnables";
import type { WorkflowEvent } from "../events";
import { rerankEvidence as rerankService } from "../services/rerank";

export async function rerankEvidence(
  state: WorkflowState,
  config?: RunnableConfig,
): Promise<Partial<WorkflowState>> {
  const send = config?.configurable?.send as ((e: WorkflowEvent) => void) | undefined;
  const requestId = config?.configurable?.requestId as string ?? "";

  send?.({ type: "data-node", ts: Date.now(), requestId, data: { node: "rerankEvidence", status: "running", ts: Date.now(), requestId } });

  const reranked = await rerankService(state.normalizedQuestion || state.userQuestion, state.retrievedDocs);

  send?.({ type: "data-node", ts: Date.now(), requestId, data: { node: "rerankEvidence", status: "completed", ts: Date.now(), requestId } });
  return { rerankedDocs: reranked };
}
