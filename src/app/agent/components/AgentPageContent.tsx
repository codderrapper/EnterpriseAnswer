"use client";

import dynamic from "next/dynamic";
import AppShellNav from "@/components/AppShellNav";
import AgentChat from "./AgentChat";
import NodeDetailPanel from "./NodeDetailPanel";

// ReactFlow depends on DOM APIs — must be client-side only
const AgentGraph = dynamic(() => import("./AgentGraph"), { ssr: false });

export default function AgentPageContent() {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-gray-100 text-gray-900">
      <div className="border-b border-gray-200 bg-white px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-sm font-semibold text-gray-900">Workflow Lab</h1>
            <p className="text-xs text-gray-500">
              Debug 视角下的实验性工作流与执行细节视图
            </p>
          </div>
          <AppShellNav
            secondaryItems={[
              { href: "/debug", label: "Debug" },
              { href: "/debug/workflow", label: "Workflow Lab" },
              { href: "/debug/search", label: "Search Lab" },
            ]}
          />
        </div>
      </div>

      <div className="flex flex-1 min-h-0 overflow-hidden bg-gray-950 text-white">
        {/* 左侧：ReactFlow DAG */}
        <div className="flex w-1/2 flex-col border-r border-gray-800">
          <div className="px-4 py-3 border-b border-gray-800 flex items-center gap-2">
            <span className="text-sm font-semibold text-blue-400">Workflow Graph</span>
            <span className="text-xs text-gray-500">
              CRAG 实验流程图，点击节点查看执行详情
            </span>
          </div>
          <div className="flex-1 min-h-0">
            <AgentGraph />
          </div>
        </div>

        {/* 右侧：上中下三层 */}
        <div className="flex w-1/2 flex-col">
          {/* 对话 + 输入（占 60%） */}
          <div className="flex-[3] border-b border-gray-800 overflow-hidden">
            <AgentChat />
          </div>

          {/* 节点 trace 详情（占 40%） */}
          <div className="flex-[2] overflow-hidden">
            <div className="px-4 py-2 border-b border-gray-800">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                Node Trace
              </span>
            </div>
            <NodeDetailPanel />
          </div>
        </div>
      </div>
    </div>
  );
}
