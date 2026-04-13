import type { WorkflowState } from "../state";

export async function generateAnswer(state: WorkflowState): Promise<Partial<WorkflowState>> {
  // Will be wired with LLM in Task 4; skeleton returns empty for now
  return { answerDraft: "" };
}
