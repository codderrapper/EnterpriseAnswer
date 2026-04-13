"use client";
import { useWorkflowRuntimeStore } from "@/features/knowledge-workflow/store/workflowRuntimeStore";

export default function TracePanel() {
  const { route, events } = useWorkflowRuntimeStore();

  if (!route && events.length === 0) return null;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-600">
      <div className="font-medium text-slate-800 mb-1">路由</div>
      {route && (
        <div className="text-blue-600 font-mono">{route}</div>
      )}
      {events.length > 0 && (
        <div className="mt-2 text-slate-500">{events.length} 个工作流事件</div>
      )}
    </div>
  );
}
