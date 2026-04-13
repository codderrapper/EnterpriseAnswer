import type { WorkflowState } from "../state";
import { rewriteForRetrieval } from "../services/rewrite";

export async function rewriteQuery(state: WorkflowState): Promise<Partial<WorkflowState>> {
  const { rewritten } = await rewriteForRetrieval(state.normalizedQuestion || state.userQuestion);
  return {
    normalizedQuestion: rewritten,
    rewriteCount: (state.rewriteCount || 0) + 1,
  };
}
