// src/app/agent/components/AgentGraph.tsx
// ReactFlow DAG：静态拓扑 + 动态节点状态。
// 设计原则：节点定义与状态分离——CRAG_NODES/CRAG_EDGES 是静态常量，
// nodeStatuses 从 store 驱动颜色和动画，两者通过 useMemo 合并。

"use client";

import ReactFlow, {
  Background,
  Controls,
  MarkerType,
  type Node,
  type Edge,
} from "reactflow";
import "reactflow/dist/style.css";
import { useMemo, useCallback } from "react";
import { useAgentStore, type NodeStatus } from "@/store/agentStore";
import type { NodeName } from "@/lib/crag/types";

// 静态节点位置（不随运行变化）
const CRAG_NODES: Array<Node & { id: NodeName }> = [
  { id: "retrieve",       position: { x: 200, y: 30  }, data: { label: "Retrieve" } },
  { id: "gradeDocuments", position: { x: 200, y: 150 }, data: { label: "Grade Documents" } },
  { id: "rewriteQuery",   position: { x: 30,  y: 280 }, data: { label: "Rewrite Query" } },
  { id: "generate",       position: { x: 200, y: 280 }, data: { label: "Generate" } },
  { id: "fallback",       position: { x: 380, y: 280 }, data: { label: "Fallback" } },
];

// 静态边（含 cycle 边 rewriteQuery → retrieve）
const CRAG_EDGES: Edge[] = [
  { id: "e-ret-grade",  source: "retrieve",       target: "gradeDocuments", markerEnd: { type: MarkerType.ArrowClosed } },
  { id: "e-grade-gen",  source: "gradeDocuments", target: "generate",       markerEnd: { type: MarkerType.ArrowClosed }, label: "relevant" },
  { id: "e-grade-rew",  source: "gradeDocuments", target: "rewriteQuery",   markerEnd: { type: MarkerType.ArrowClosed }, label: "retry" },
  { id: "e-grade-fall", source: "gradeDocuments", target: "fallback",       markerEnd: { type: MarkerType.ArrowClosed }, label: "max retries" },
  // cycle：type="smoothstep" + sourceHandle offset 避免与其他边重叠
  { id: "e-rew-ret",    source: "rewriteQuery",   target: "retrieve",       markerEnd: { type: MarkerType.ArrowClosed }, type: "smoothstep", label: "↩ cycle", style: { stroke: "#f59e0b" } },
];

// 节点状态 → 样式
const STATUS_STYLE: Record<NodeStatus, React.CSSProperties> = {
  idle:    { background: "#21262d", color: "#8b949e", border: "1px solid #30363d" },
  running: { background: "#1d3a6e", color: "#79c0ff", border: "1px solid #388bfd", boxShadow: "0 0 8px #388bfd88" },
  done:    { background: "#1a3a28", color: "#56d364", border: "1px solid #3fb950" },
  error:   { background: "#3d1a1a", color: "#f85149", border: "1px solid #da3633" },
};

export default function AgentGraph() {
  const { nodeStatuses, takenEdges, selectedNode, selectNode } = useAgentStore();

  // 合并静态节点 + 动态状态
  const nodes = useMemo(() =>
    CRAG_NODES.map(n => ({
      ...n,
      selected: n.id === selectedNode,
      style: {
        ...STATUS_STYLE[nodeStatuses[n.id]],
        borderRadius: 8,
        padding: "6px 14px",
        fontSize: 12,
        fontWeight: 600,
        cursor: "pointer",
        transition: "all 0.3s",
      },
    })),
    [nodeStatuses, selectedNode],
  );

  // 已走过的边高亮
  const edges = useMemo(() =>
    CRAG_EDGES.map(e => {
      const taken = takenEdges.some(t => t.from === e.source && t.to === e.target);
      return taken
        ? { ...e, style: { ...e.style, stroke: "#3fb950", strokeWidth: 2 } }
        : e;
    }),
    [takenEdges],
  );

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    selectNode(node.id as NodeName);
  }, [selectNode]);

  return (
    <div className="h-full w-full" style={{ background: "#0d1117" }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodeClick={onNodeClick}
        fitView
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#30363d" gap={20} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
