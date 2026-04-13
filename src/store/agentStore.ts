// @deprecated: Migrating to features/knowledge-workflow/store/workflowRuntimeStore. Do not add new code here.
// src/store/agentStore.ts
// 消费 /api/agent 的 JSONL 流，将 AgentEvent 映射到 UI 状态。
// 与 chatStore 相同的流解析模式，但状态结构专为 CRAG 可视化设计。

"use client";

import { create } from "zustand";
import type { AgentEvent, NodeName, NodeOutputSummary } from "@/lib/crag/types";

export type NodeStatus = "idle" | "running" | "done" | "error";

export interface TakenEdge {
  from: NodeName;
  to:   NodeName;
}

interface AgentStoreState {
  // 运行状态
  isRunning: boolean;
  question:  string;
  answer:    string;
  runId:     number | null;
  error:     string | null;

  // 节点可视化状态（ReactFlow 消费）
  nodeStatuses: Record<NodeName, NodeStatus>;
  nodeData:     Record<NodeName, NodeOutputSummary | null>;
  takenEdges:   TakenEdge[];

  // 右侧面板：点击节点后显示该节点详情
  selectedNode: NodeName | null;

  // Actions
  setQuestion:  (q: string) => void;
  selectNode:   (id: NodeName | null) => void;
  run:          () => Promise<void>;
  reset:        () => void;
}

const DEFAULT_NODE_STATUSES: Record<NodeName, NodeStatus> = {
  retrieve:       "idle",
  gradeDocuments: "idle",
  rewriteQuery:   "idle",
  generate:       "idle",
  fallback:       "idle",
};

export const useAgentStore = create<AgentStoreState>((set, get) => ({
  isRunning:    false,
  question:     "",
  answer:       "",
  runId:        null,
  error:        null,
  nodeStatuses: { ...DEFAULT_NODE_STATUSES },
  nodeData:     { retrieve: null, gradeDocuments: null, rewriteQuery: null, generate: null, fallback: null },
  takenEdges:   [],
  selectedNode: null,

  setQuestion: (q) => set({ question: q }),

  selectNode: (id) => set({ selectedNode: id }),

  reset: () => set({
    isRunning:    false,
    answer:       "",
    runId:        null,
    error:        null,
    nodeStatuses: { ...DEFAULT_NODE_STATUSES },
    nodeData:     { retrieve: null, gradeDocuments: null, rewriteQuery: null, generate: null, fallback: null },
    takenEdges:   [],
    selectedNode: null,
  }),

  run: async () => {
    const { question, isRunning } = get();
    if (!question.trim() || isRunning) return;

    get().reset();
    set({ isRunning: true, question: question.trim() });

    try {
      const res = await fetch("/api/agent", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ question: question.trim() }),
      });

      if (!res.ok || !res.body) {
        set({ error: `HTTP ${res.status}`, isRunning: false });
        return;
      }

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line) as AgentEvent;
            applyEvent(event);
          } catch {
            // 忽略解析失败的行
          }
        }
      }
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
    } finally {
      set({ isRunning: false });
    }

    // 把 AgentEvent 映射到 store state（纯函数，便于测试）
    function applyEvent(event: AgentEvent) {
      switch (event.type) {
        case "node_started":
          set(s => ({
            nodeStatuses: { ...s.nodeStatuses, [event.node]: "running" },
          }));
          break;

        case "node_completed":
          set(s => ({
            nodeStatuses: { ...s.nodeStatuses, [event.node]: "done" },
            nodeData:     { ...s.nodeData, [event.node]: event.data ?? null },
          }));
          break;

        case "edge_taken":
          set(s => ({
            takenEdges: [...s.takenEdges, { from: event.from, to: event.to }],
          }));
          break;

        case "token":
          set(s => ({ answer: s.answer + event.value }));
          break;

        case "run_completed":
          set({ runId: event.runId });
          break;

        case "error":
          if (event.node) {
            set(s => ({
              nodeStatuses: { ...s.nodeStatuses, [event.node!]: "error" },
              error:        event.message,
            }));
          } else {
            set({ error: event.message });
          }
          break;
      }
    }
  },
}));
