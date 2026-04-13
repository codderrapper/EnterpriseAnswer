import type { WorkflowState } from "../state";
import type { WorkflowRoute } from "../types";

export async function routeTask(state: WorkflowState): Promise<Partial<WorkflowState>> {
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

  return { route };
}
