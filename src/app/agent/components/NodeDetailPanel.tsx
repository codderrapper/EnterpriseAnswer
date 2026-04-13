// src/app/agent/components/NodeDetailPanel.tsx
// @deprecated This component uses the legacy useAgentStore pattern and should not
// evolve further. The canonical pattern is in src/features/chat/ (useChat hook +
// workflowRuntimeStore). New node/trace UI work should extend that instead.
// 点击 DAG 节点后展示该节点的执行详情。
// 每种节点类型有专属展示——这是让面试官感受到"工程深度"的关键组件：
// gradeDocuments 展示 per-chunk 评分表，rewriteQuery 展示改写前后对比。

"use client";

import { useAgentStore } from "@/store/agentStore";
import type { NodeName, NodeOutputSummary } from "@/lib/crag/types";

function RetrieveDetail({ data }: { data: Extract<NodeOutputSummary, { node: "retrieve" }> }) {
  return (
    <div className="space-y-1 text-sm">
      <div className="flex justify-between">
        <span className="text-gray-400">命中片段</span>
        <span className="text-white font-mono">{data.count}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-gray-400">最高相似度</span>
        <span className="text-green-400 font-mono">{data.topSimilarity.toFixed(3)}</span>
      </div>
    </div>
  );
}

function GradeDetail({ data }: { data: Extract<NodeOutputSummary, { node: "gradeDocuments" }> }) {
  return (
    <div className="space-y-2 text-sm">
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-green-900/30 rounded p-2">
          <div className="text-green-400 font-bold text-lg">{data.relevant}</div>
          <div className="text-gray-400 text-xs">relevant</div>
        </div>
        <div className="bg-yellow-900/30 rounded p-2">
          <div className="text-yellow-400 font-bold text-lg">{data.partial}</div>
          <div className="text-gray-400 text-xs">partial</div>
        </div>
        <div className="bg-red-900/30 rounded p-2">
          <div className="text-red-400 font-bold text-lg">{data.irrelevant}</div>
          <div className="text-gray-400 text-xs">irrelevant</div>
        </div>
      </div>
      <div className="flex justify-between">
        <span className="text-gray-400">路由决策</span>
        <span className={`font-mono font-bold ${
          data.route === "generate" ? "text-green-400" :
          data.route === "rewrite"  ? "text-yellow-400" : "text-red-400"
        }`}>{data.route}</span>
      </div>
    </div>
  );
}

function RewriteDetail({ data }: { data: Extract<NodeOutputSummary, { node: "rewriteQuery" }> }) {
  return (
    <div className="space-y-3 text-sm">
      <div>
        <div className="text-gray-400 text-xs mb-1">原始查询</div>
        <div className="bg-gray-800 rounded p-2 text-gray-300">{data.original}</div>
      </div>
      <div className="text-gray-500 text-center">↓ 改写</div>
      <div>
        <div className="text-gray-400 text-xs mb-1">新查询</div>
        <div className="bg-blue-900/30 rounded p-2 text-blue-300">{data.rewritten}</div>
      </div>
    </div>
  );
}

function GenerateDetail({ data }: { data: Extract<NodeOutputSummary, { node: "generate" }> }) {
  return (
    <div className="text-sm">
      <div className="flex justify-between">
        <span className="text-gray-400">输出字符数</span>
        <span className="text-purple-400 font-mono">{data.chars}</span>
      </div>
    </div>
  );
}

function FallbackDetail({ data }: { data: Extract<NodeOutputSummary, { node: "fallback" }> }) {
  return (
    <div className="space-y-1 text-sm">
      <div className="flex justify-between">
        <span className="text-gray-400">原因</span>
        <span className="text-red-400 font-mono text-xs">{data.reason}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-gray-400">重试次数</span>
        <span className="text-white font-mono">{data.retryCount}</span>
      </div>
    </div>
  );
}

const NODE_LABEL: Record<NodeName, string> = {
  retrieve:       "Retrieve",
  gradeDocuments: "Grade Documents",
  rewriteQuery:   "Rewrite Query",
  generate:       "Generate",
  fallback:       "Fallback",
};

export default function NodeDetailPanel() {
  const { selectedNode, nodeData, nodeStatuses } = useAgentStore();

  if (!selectedNode) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500 text-sm">
        点击左侧节点查看执行详情
      </div>
    );
  }

  const data   = nodeData[selectedNode];
  const status = nodeStatuses[selectedNode];

  return (
    <div className="h-full p-4 overflow-auto">
      <div className="flex items-center gap-2 mb-4">
        <span className={`w-2 h-2 rounded-full ${
          status === "running" ? "bg-blue-400 animate-pulse" :
          status === "done"    ? "bg-green-400" :
          status === "error"   ? "bg-red-400" : "bg-gray-600"
        }`} />
        <h3 className="text-white font-semibold">{NODE_LABEL[selectedNode]}</h3>
        <span className="text-xs text-gray-500 ml-auto">{status}</span>
      </div>

      {!data && status === "idle" && (
        <div className="text-gray-500 text-sm">未执行</div>
      )}
      {!data && status === "running" && (
        <div className="text-blue-400 text-sm animate-pulse">执行中...</div>
      )}

      {data && data.node === "retrieve"       && <RetrieveDetail data={data} />}
      {data && data.node === "gradeDocuments" && <GradeDetail    data={data} />}
      {data && data.node === "rewriteQuery"   && <RewriteDetail  data={data} />}
      {data && data.node === "generate"       && <GenerateDetail data={data} />}
      {data && data.node === "fallback"       && <FallbackDetail data={data} />}
    </div>
  );
}
