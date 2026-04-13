export type WorkflowEvent =
  | { type: "data-run"; ts: number; requestId: string; data: Record<string, unknown> }
  | { type: "data-route"; ts: number; requestId: string; data: Record<string, unknown> }
  | { type: "data-node"; ts: number; requestId: string; data: Record<string, unknown> }
  | { type: "data-evidence"; ts: number; requestId: string; data: Record<string, unknown> }
  | { type: "data-verification"; ts: number; requestId: string; data: Record<string, unknown> }
  | { type: "data-clarification"; ts: number; requestId: string; data: Record<string, unknown> };
