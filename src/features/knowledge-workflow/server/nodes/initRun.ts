import type { WorkflowState } from "../state";

export async function initRun(state: WorkflowState): Promise<Partial<WorkflowState>> {
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
