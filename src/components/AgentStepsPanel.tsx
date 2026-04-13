// src/components/AgentStepsPanel.tsx
// @deprecated: This component is being migrated to features/chat/components/.
// Do not add new workflow-specific features here.
"use client";

import { useState } from "react";
import type { AgentStep, StepStatus } from "@/types/agent";

interface Props {
  steps: AgentStep[];
}

// 💡 将 Agent 执行过程封装成独立组件，而不是写死在 page.tsx 里：
// 1）职责单一：只关心“展示步骤”
// 2）更利于复用：以后可以在 /agent /debug 等页面复用
// 3）更利于测试和维护
export default function AgentStepsPanel({ steps }: Props) {
  const [collapsed, setCollapsed] = useState(false);

  if (steps.length === 0) return null;

  const colorMap: Record<StepStatus, string> = {
    pending: "bg-gray-300",
    running: "bg-blue-400",
    done: "bg-green-400",
    error: "bg-red-400",
  };

  const textMap: Record<StepStatus, string> = {
    pending: "待执行",
    running: "执行中",
    done: "已完成",
    error: "出错",
  };

  return (
    <div className="px-4 pb-2">
      <div className="bg-white border rounded shadow-sm text-xs text-gray-800 overflow-hidden">
        {/* 标题栏 + 折叠按钮 */}
        <div className="flex items-center justify-between px-3 py-2 border-b bg-gray-50">
          <div className="font-semibold text-gray-700 flex items-center gap-1">
            <span>🤖 Agent 执行过程</span>
            <span className="text-[10px] text-gray-400">
              （共 {steps.length} 步）
            </span>
          </div>
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            className="text-[11px] text-gray-500 hover:text-gray-800"
          >
            {collapsed ? "展开详情" : "收起"}
          </button>
        </div>

        {/* 折叠时只保留标题栏 */}
        {!collapsed && (
          <div className="p-3 space-y-2 max-h-40 overflow-y-auto">
            {steps.map((step) => (
              <div key={step.id} className="flex items-start gap-2">
                {/* 状态小圆点 */}
                <span
                  className={`mt-1 h-2 w-2 rounded-full ${colorMap[step.status]}`}
                />
                <div>
                  <div className="font-medium">
                    {step.title}{" "}
                    <span className="text-gray-500">
                      ({textMap[step.status]})
                    </span>
                  </div>
                  {step.detail && (
                    <div className="text-gray-500 mt-0.5">{step.detail}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
