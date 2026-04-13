import type { WorkflowState } from "../state";

export async function gradeEvidence(state: WorkflowState): Promise<Partial<WorkflowState>> {
  // Grade and filter evidence. Select top relevant docs.
  const selected = state.rerankedDocs.filter(d => d.relevance === "relevant" || d.relevance === "partial");
  return { selectedEvidence: selected.length > 0 ? selected : state.rerankedDocs.slice(0, 3) };
}
