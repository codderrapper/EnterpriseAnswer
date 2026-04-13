import type { WorkflowState } from "../state";
import type { RunnableConfig } from "@langchain/core/runnables";
import type { WorkflowEvent } from "../events";

export async function gradeEvidence(
  state: WorkflowState,
  config?: RunnableConfig,
): Promise<Partial<WorkflowState>> {
  const send = config?.configurable?.send as ((e: WorkflowEvent) => void) | undefined;
  const requestId = config?.configurable?.requestId as string ?? "";

  send?.({ type: "data-node", ts: Date.now(), requestId, data: { node: "gradeEvidence", status: "running", ts: Date.now(), requestId } });

  // Grade and filter evidence. Select top relevant docs.
  const selected = state.rerankedDocs.filter(d => d.relevance === "relevant" || d.relevance === "partial");

  send?.({ type: "data-node", ts: Date.now(), requestId, data: { node: "gradeEvidence", status: "completed", ts: Date.now(), requestId } });
  return { selectedEvidence: selected.length > 0 ? selected : state.rerankedDocs.slice(0, 3) };
}
