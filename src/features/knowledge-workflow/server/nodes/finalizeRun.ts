import type { WorkflowState } from "../state";
import type { RunnableConfig } from "@langchain/core/runnables";
import type { WorkflowEvent } from "../events";

export async function finalizeRun(
  state: WorkflowState,
  config?: RunnableConfig,
): Promise<Partial<WorkflowState>> {
  const send = config?.configurable?.send as ((e: WorkflowEvent) => void) | undefined;
  const requestId = config?.configurable?.requestId as string ?? "";

  send?.({
    type: "data-run",
    ts: Date.now(),
    requestId,
    data: {
      kind: "run_completed",
      ts: Date.now(),
      requestId,
      route: state.route,
      status: state.finalAnswer ? "answered" : "fallback",
    },
  });

  return {};
}
