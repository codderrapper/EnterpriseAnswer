import type { WorkflowState } from "../state";
import { rerankEvidence as rerankService } from "../services/rerank";

export async function rerankEvidence(state: WorkflowState): Promise<Partial<WorkflowState>> {
  const reranked = await rerankService(state.normalizedQuestion || state.userQuestion, state.retrievedDocs);
  return { rerankedDocs: reranked };
}
