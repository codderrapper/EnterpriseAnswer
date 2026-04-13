import type { WorkflowState } from "../state";
import type { RunnableConfig } from "@langchain/core/runnables";
import type { WorkflowEvent } from "../events";
import { retrieveEvidence as retrieveService } from "../services/retrieve";

// Note: supabase must be injected via config.configurable
export async function retrieveEvidence(
  state: WorkflowState,
  config?: RunnableConfig,
): Promise<Partial<WorkflowState>> {
  const send = config?.configurable?.send as ((e: WorkflowEvent) => void) | undefined;
  const requestId = config?.configurable?.requestId as string ?? "";

  const supabase = config?.configurable?.supabase;
  if (!supabase) return { retrievedDocs: state.retrievedDocs ?? [] };

  const docs = await retrieveService({
    question: state.normalizedQuestion || state.userQuestion,
    workspaceId: state.workspaceId,
    supabase,
    topK: 5,
    threshold: 0.4,
  });

  send?.({
    type: "data-evidence",
    ts: Date.now(),
    requestId,
    data: {
      kind: "evidence_updated",
      ts: Date.now(),
      requestId,
      stage: "retrieved",
      documents: docs.map(d => ({ id: d.id, documentId: d.documentId, similarity: d.similarity, content: d.content.slice(0, 200) })),
    },
  });

  return { retrievedDocs: docs };
}
