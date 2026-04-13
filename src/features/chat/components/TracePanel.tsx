"use client";
import { useWorkflowRuntimeStore } from "@/features/knowledge-workflow/store/workflowRuntimeStore";

const STATUS_LABEL: Record<string, string> = {
  idle: "待机",
  running: "运行中",
  done: "完成",
  error: "错误",
};

export default function TracePanel() {
  const { route, traceNodes } = useWorkflowRuntimeStore();

  if (!route && traceNodes.length === 0) return null;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-600">
      <div className="font-medium text-slate-800 mb-1">路由</div>
      {route && (
        <div className="text-blue-600 font-mono mb-2">{route}</div>
      )}
      {traceNodes.length > 0 && (
        <div>
          <div className="font-medium text-slate-800 mb-1">节点追踪</div>
          <ul className="space-y-1">
            {traceNodes.map((node) => (
              <li key={node.name} className="flex items-center justify-between gap-2">
                <span className="font-mono text-slate-700">{node.name}</span>
                <span
                  className={
                    node.status === "done"
                      ? "text-green-600"
                      : node.status === "running"
                        ? "text-blue-500"
                        : node.status === "error"
                          ? "text-red-500"
                          : "text-slate-400"
                  }
                >
                  {STATUS_LABEL[node.status] ?? node.status}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
