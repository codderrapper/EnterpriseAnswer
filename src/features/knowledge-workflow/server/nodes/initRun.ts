import type { WorkflowState } from "../state";
import type { RunnableConfig } from "@langchain/core/runnables";
import type { WorkflowEvent } from "../events";

export async function initRun(
  state: WorkflowState,
  config?: RunnableConfig,
): Promise<Partial<WorkflowState>> {
  const send = config?.configurable?.send as ((e: WorkflowEvent) => void) | undefined;
  const requestId = (config?.configurable?.requestId as string) ?? "";

  send?.({
    type: "data-run",
    ts: Date.now(),
    requestId,
    data: { kind: "run_started", ts: Date.now(), requestId, question: state.userQuestion, workspaceId: state.workspaceId },
  });

  return {
    normalizedQuestion: state.userQuestion.trim(),
    rewriteCount: 0,
    retrievedDocs: [],
    rerankedDocs: [],
    selectedEvidence: [],
    answerDraft: "",
    finalAnswer: "",
  };
}
