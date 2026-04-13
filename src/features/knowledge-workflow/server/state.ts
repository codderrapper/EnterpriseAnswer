import type { WorkflowRoute, EvidenceDoc } from "./types";

export type WorkflowState = {
  userQuestion: string;
  normalizedQuestion: string;
  workspaceId: string;
  route?: WorkflowRoute;
  rewriteCount: number;
  retrievedDocs: EvidenceDoc[];
  rerankedDocs: EvidenceDoc[];
  selectedEvidence: EvidenceDoc[];
  answerDraft: string;
  finalAnswer: string;
};
