// src/features/knowledge-workflow/store/workflowRuntimeStore.ts
"use client";
import { create } from "zustand";
import type { WorkflowRoute } from "@/features/knowledge-workflow/server/types";
import type { WorkflowEvent } from "@/features/knowledge-workflow/server/events";

export type TraceNode = {
  name: string;
  status: "idle" | "running" | "done" | "error";
  completedAt?: number;
};

export type EvidenceItem = {
  id: string;
  documentId?: number;
  similarity?: number;
  relevance?: string;
  content: string;  // was "snippet", renamed to match EvidenceDoc.content
};

export type VerificationResult = {
  grounded: boolean;
  reason: string;
  unsupportedClaims?: number;
} | null;

interface WorkflowRuntimeState {
  route: WorkflowRoute | null;
  events: WorkflowEvent[];
  traceNodes: TraceNode[];
  retrievedDocs: EvidenceItem[];
  rerankedDocs: EvidenceItem[];
  selectedDocs: EvidenceItem[];
  verification: VerificationResult;

  // Actions
  applyRouteEvent: (route: WorkflowRoute, reason: string) => void;
  applyEvidenceEvent: (stage: "retrieved" | "reranked" | "selected", documents: EvidenceItem[]) => void;
  applyNodeEvent: (node: string, status: TraceNode["status"]) => void;
  applyVerificationEvent: (result: VerificationResult) => void;
  reset: () => void;
}

const initialState = {
  route: null as WorkflowRoute | null,
  events: [] as WorkflowEvent[],
  traceNodes: [] as TraceNode[],
  retrievedDocs: [] as EvidenceItem[],
  rerankedDocs: [] as EvidenceItem[],
  selectedDocs: [] as EvidenceItem[],
  verification: null as VerificationResult,
};

export const useWorkflowRuntimeStore = create<WorkflowRuntimeState>((set) => ({
  ...initialState,

  applyRouteEvent: (route, reason) =>
    set((s) => ({
      route,
      events: [...s.events, {
        type: "data-route" as const,
        ts: Date.now(),
        requestId: "",
        data: { kind: "route_decided", route, reason },
      }],
    })),

  applyEvidenceEvent: (stage, documents) =>
    set((s) => {
      const update =
        stage === "retrieved"
          ? { retrievedDocs: documents }
          : stage === "reranked"
            ? { rerankedDocs: documents }
            : { selectedDocs: documents };
      return {
        ...update,
        events: [...s.events, {
          type: "data-evidence" as const,
          ts: Date.now(),
          requestId: "",
          data: { kind: "evidence_updated", stage, documents },
        }],
      };
    }),

  applyNodeEvent: (node, status) =>
    set((s) => {
      // Update existing node entry or append a new one
      const existingIdx = s.traceNodes.findIndex((n) => n.name === node);
      const updatedNode: TraceNode = {
        name: node,
        status,
        ...(status === "done" ? { completedAt: Date.now() } : {}),
      };
      const traceNodes =
        existingIdx >= 0
          ? s.traceNodes.map((n, i) => (i === existingIdx ? updatedNode : n))
          : [...s.traceNodes, updatedNode];
      return {
        traceNodes,
        events: [...s.events, {
          type: "data-node" as const,
          ts: Date.now(),
          requestId: "",
          data: { node, status },
        }],
      };
    }),

  applyVerificationEvent: (result) =>
    set((s) => ({
      verification: result,
      events: [...s.events, {
        type: "data-verification" as const,
        ts: Date.now(),
        requestId: "",
        data: result as Record<string, unknown>,
      }],
    })),

  reset: () => set(initialState),
}));
