// src/lib/crag/types.ts

export type NodeName =
  | "retrieve"
  | "gradeDocuments"
  | "rewriteQuery"
  | "generate"
  | "fallback";

export type Chunk = {
  id: string;
  content: string;
  metadata?: {
    documentId?: number;
    similarity?: number;
    [key: string]: unknown;
  };
};

export type GradedChunk = Chunk & {
  relevance: "relevant" | "partial" | "irrelevant";
  confidence: number;    // 0–1
  reason: string;
};

export type Decision = {
  route: "generate" | "rewrite" | "fallback";
  reason: string;
};

export type CragState = {
  originalQuestion: string;
  activeQuery: string;
  queryHistory: string[];
  retryCount: number;
  topK: number;
  threshold: number;
  retrievedDocs: Chunk[];
  gradedDocs: GradedChunk[];
  selectedDocs: GradedChunk[];
  decision?: Decision;
  answer: string;
  fallbackMessage?: string;
};

// Frontend streaming protocol — strictly separate from CragState.
// Nodes emit these via config.configurable.send, never stored in graph state.

export type NodeOutputSummary =
  | { node: "retrieve";       count: number; topSimilarity: number }
  | { node: "gradeDocuments"; relevant: number; partial: number; irrelevant: number; route: string }
  | { node: "rewriteQuery";   original: string; rewritten: string }
  | { node: "generate";       chars: number }
  | { node: "fallback";       reason: string; retryCount: number };

export type AgentEvent =
  | { type: "node_started";   node: NodeName; ts: number }
  | { type: "node_completed"; node: NodeName; ts: number; data?: NodeOutputSummary }
  | { type: "edge_taken";     from: NodeName; to: NodeName; reason?: string }
  | { type: "token";          value: string }
  | { type: "run_completed";  runId: number }
  | { type: "error";          node?: NodeName; message: string };

export type SendFn = (event: AgentEvent) => void;
