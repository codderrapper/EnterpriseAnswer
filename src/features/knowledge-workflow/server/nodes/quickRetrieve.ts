import type { WorkflowState } from "../state";
import type { RunnableConfig } from "@langchain/core/runnables";
import { retrieveEvidence as retrieveService } from "../services/retrieve";

export async function quickRetrieve(
  state: WorkflowState,
  config?: RunnableConfig,
): Promise<Partial<WorkflowState>> {
  const supabase = config?.configurable?.supabase;
  if (!supabase) return { retrievedDocs: [] };

  const docs = await retrieveService({
    question: state.normalizedQuestion || state.userQuestion,
    workspaceId: state.workspaceId,
    supabase,
    topK: 3, // Quick, cheap retrieve for routing signal
    threshold: 0.4,
  });

  return { retrievedDocs: docs };
}
