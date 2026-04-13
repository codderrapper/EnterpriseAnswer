import type { WorkflowState } from "../state";

export async function finalizeRun(state: WorkflowState): Promise<Partial<WorkflowState>> {
  // Will write run history in Task 4; skeleton is a no-op
  return {};
}
