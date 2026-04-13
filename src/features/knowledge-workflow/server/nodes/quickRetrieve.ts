import type { WorkflowState } from "../state";

export async function quickRetrieve(state: WorkflowState): Promise<Partial<WorkflowState>> {
  // This node needs supabase injected via config.configurable.
  // For now, if supabase is not available (tests), return empty docs.
  return { retrievedDocs: [] };
}
