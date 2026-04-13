import type { WorkflowState } from "../state";
import type { RunnableConfig } from "@langchain/core/runnables";
import { retrieveEvidence as retrieveService } from "../services/retrieve";

// Note: supabase must be injected via config.configurable
export async function retrieveEvidence(
  state: WorkflowState,
  config?: RunnableConfig,
): Promise<Partial<WorkflowState>> {
  const supabase = config?.configurable?.supabase;
  if (!supabase) return { retrievedDocs: state.retrievedDocs ?? [] };

  const docs = await retrieveService({
    question: state.normalizedQuestion || state.userQuestion,
    workspaceId: state.workspaceId,
    supabase,
    topK: 5,
    threshold: 0.4,
  });

  return { retrievedDocs: docs };
}
