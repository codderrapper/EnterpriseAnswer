import type { WorkflowState } from "../state";
import type { WorkflowRoute } from "../types";
import type { RunnableConfig } from "@langchain/core/runnables";
import type { WorkflowEvent } from "../events";

export async function routeTask(
  state: WorkflowState,
  config?: RunnableConfig,
): Promise<Partial<WorkflowState>> {
  const send = config?.configurable?.send as ((e: WorkflowEvent) => void) | undefined;
  const requestId = config?.configurable?.requestId as string ?? "";

  const q = (state.normalizedQuestion || state.userQuestion).toLowerCase();
  const isComparison = q.includes("对比") || q.includes("差异") || q.includes("compare") || q.includes("difference");
  const isSummary = q.includes("总结") || q.includes("汇总") || q.includes("summary");
  const isAnalysis = q.includes("分析") || q.includes("analysis") || q.includes("checklist");

  const isLowConfidence = state.retrievedDocs.length === 0;

  let route: WorkflowRoute;
  if (isComparison || isSummary || isAnalysis || isLowConfidence) {
    route = "workflow_qa";
  } else {
    route = "fast_qa";
  }

  send?.({
    type: "data-route",
    ts: Date.now(),
    requestId,
    data: {
      kind: "route_decided",
      ts: Date.now(),
      requestId,
      route,
      reason: isComparison ? "question_requires_comparison" : isLowConfidence ? "low_confidence_evidence" : "direct_question",
    },
  });

  return { route };
}
