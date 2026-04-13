// @deprecated — src/lib/crag is no longer the canonical module.
// This file is a compatibility shim. Use src/features/knowledge-workflow/server/ directly.
export type {
  NodeName,
  Chunk,
  GradedChunk,
  Decision,
  CragState,
  NodeOutputSummary,
  AgentEvent,
  SendFn,
} from "@/features/knowledge-workflow/server/legacy-crag-types";
