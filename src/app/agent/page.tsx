// src/app/agent/page.tsx
import dynamic from "next/dynamic";
import AgentChat from "./components/AgentChat";
import NodeDetailPanel from "./components/NodeDetailPanel";

// ReactFlow 必须 client-side only（依赖 DOM API）
const AgentGraph = dynamic(() => import("./components/AgentGraph"), { ssr: false });

export const metadata = { title: "CRAG Agent" };

export default function AgentPage() {
  return (
    <div className="flex h-screen bg-gray-950 text-white overflow-hidden">
      {/* 左侧：ReactFlow DAG */}
      <div className="w-1/2 border-r border-gray-800">
        <div className="px-4 py-3 border-b border-gray-800 flex items-center gap-2">
          <span className="text-sm font-semibold text-blue-400">CRAG Graph</span>
          <span className="text-xs text-gray-500">点击节点查看执行详情</span>
        </div>
        <div className="h-[calc(100vh-49px)]">
          <AgentGraph />
        </div>
      </div>

      {/* 右侧：上中下三层 */}
      <div className="w-1/2 flex flex-col">
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
  );
}
