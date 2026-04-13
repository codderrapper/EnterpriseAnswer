export type WorkflowRoute = "fast_qa" | "workflow_qa" | "clarification" | "fallback";

export type EvidenceDoc = {
  id: string;
  documentId?: number;
  content: string;
  similarity?: number;
  relevance?: "relevant" | "partial" | "irrelevant";
};
