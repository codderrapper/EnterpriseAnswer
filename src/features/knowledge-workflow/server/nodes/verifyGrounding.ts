import type { WorkflowState } from "../state";
import type { RunnableConfig } from "@langchain/core/runnables";
import type { WorkflowEvent } from "../events";

export async function verifyGrounding(
  state: WorkflowState,
  config?: RunnableConfig,
): Promise<Partial<WorkflowState>> {
  const send = config?.configurable?.send as ((e: WorkflowEvent) => void) | undefined;
  const requestId = config?.configurable?.requestId as string ?? "";

  send?.({ type: "data-node", ts: Date.now(), requestId, data: { node: "verifyGrounding", status: "running", ts: Date.now(), requestId } });

  // If no answer draft, fallback
  if (!state.answerDraft) {
    send?.({ type: "data-node", ts: Date.now(), requestId, data: { node: "verifyGrounding", status: "completed", ts: Date.now(), requestId } });
    return { finalAnswer: state.answerDraft, route: "fallback" };
  }

  send?.({ type: "data-node", ts: Date.now(), requestId, data: { node: "verifyGrounding", status: "completed", ts: Date.now(), requestId } });
  return { finalAnswer: state.answerDraft };
}
