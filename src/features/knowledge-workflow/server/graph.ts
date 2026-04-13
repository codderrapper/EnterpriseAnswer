import type { WorkflowState } from "./state";

export function createKnowledgeWorkflowGraph() {
  return {
    invoke: async (state: WorkflowState) => state,
  };
}
