import type { WorkflowState } from "../state";

// Note: supabase must be injected via config.configurable
export async function retrieveEvidence(state: WorkflowState): Promise<Partial<WorkflowState>> {
  // Will be wired up with supabase in Task 4 when called from the API route
  return { retrievedDocs: state.retrievedDocs ?? [] };
}
