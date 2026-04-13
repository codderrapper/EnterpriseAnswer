import type { WorkflowState } from "../state";
import type { RunnableConfig } from "@langchain/core/runnables";
import type { WorkflowEvent } from "../events";
import { retrieveEvidence as retrieveService } from "../services/retrieve";

export async function quickRetrieve(
  state: WorkflowState,
  config?: RunnableConfig,
): Promise<Partial<WorkflowState>> {
  const send = config?.configurable?.send as ((e: WorkflowEvent) => void) | undefined;
  const requestId = config?.configurable?.requestId as string ?? "";

  send?.({ type: "data-node", ts: Date.now(), requestId, data: { node: "quickRetrieve", status: "running", ts: Date.now(), requestId } });

  const supabase = config?.configurable?.supabase;
  if (!supabase) {
    send?.({ type: "data-node", ts: Date.now(), requestId, data: { node: "quickRetrieve", status: "completed", ts: Date.now(), requestId } });
    return { retrievedDocs: [] };
  }

  const docs = await retrieveService({
    question: state.normalizedQuestion || state.userQuestion,
    workspaceId: state.workspaceId,
    supabase,
    topK: 3, // Quick, cheap retrieve for routing signal
    threshold: 0.4,
  });

  send?.({ type: "data-node", ts: Date.now(), requestId, data: { node: "quickRetrieve", status: "completed", ts: Date.now(), requestId } });
  return { retrievedDocs: docs };
}
