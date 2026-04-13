import type { WorkflowState } from "../state";

export async function verifyGrounding(state: WorkflowState): Promise<Partial<WorkflowState>> {
  // If no answer draft, fallback
  if (!state.answerDraft) {
    return { finalAnswer: state.answerDraft, route: "fallback" };
  }
  return { finalAnswer: state.answerDraft };
}
