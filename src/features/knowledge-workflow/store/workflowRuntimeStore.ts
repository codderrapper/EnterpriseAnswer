// src/features/knowledge-workflow/store/workflowRuntimeStore.ts
"use client";
import { create } from "zustand";
import type { WorkflowRoute } from "@/features/knowledge-workflow/server/types";

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
  snippet: string;
};

export type VerificationResult = {
  grounded: boolean;
  reason: string;
  unsupportedClaims?: number;
} | null;

interface WorkflowRuntimeState {
  route: WorkflowRoute | null;
  events: unknown[];
  traceNodes: TraceNode[];
  retrievedDocs: EvidenceItem[];
  rerankedDocs: EvidenceItem[];
  selectedDocs: EvidenceItem[];
  verification: VerificationResult;

  // Actions
  applyRouteEvent: (route: WorkflowRoute, reason: string) => void;
  applyEvidenceEvent: (stage: "retrieved" | "reranked" | "selected", documents: EvidenceItem[]) => void;
  reset: () => void;
}

const initialState = {
  route: null as WorkflowRoute | null,
  events: [] as unknown[],
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
      events: [...s.events, { type: "data-route", data: { kind: "route_decided", route, reason } }],
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
        events: [...s.events, { type: "data-evidence", data: { kind: "evidence_updated", stage, documents } }],
      };
    }),

  reset: () => set(initialState),
}));
