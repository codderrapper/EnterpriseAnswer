import { describe, expect, it } from "vitest";
import { normalizeMatchRow } from "../services/retrieve";
import { routeTask } from "../nodes/routeTask";
import type { WorkflowState } from "../state";

describe("retrieve service", () => {
  it("normalizes rpc rows into evidence docs", async () => {
    const row = {
      id: 42,
      document_id: 7,
      content: "hello world",
      similarity: 0.87,
    };

    const doc = normalizeMatchRow(row);

    // id must be stringified
    expect(doc.id).toBe("42");
    expect(typeof doc.id).toBe("string");

    // documentId maps from document_id
    expect(doc.documentId).toBe(7);

    // content passes through
    expect(doc.content).toBe("hello world");

    // similarity passes through
    expect(doc.similarity).toBe(0.87);
  });

  it("handles score field as fallback for similarity", () => {
    const row = { id: 1, document_id: 2, content: "chunk", score: 0.5 };
    const doc = normalizeMatchRow(row);
    expect(doc.similarity).toBe(0.5);
  });

  it("coerces non-finite similarity to 0", () => {
    const row = { id: 1, document_id: 2, content: "chunk", similarity: NaN };
    const doc = normalizeMatchRow(row);
    expect(doc.similarity).toBe(0);
  });
});

const baseState: WorkflowState = {
  userQuestion: "",
  normalizedQuestion: "",
  workspaceId: "ws-test",
  rewriteCount: 0,
  retrievedDocs: [{ id: "1", content: "test", similarity: 0.9 }],
  rerankedDocs: [],
  selectedEvidence: [],
  answerDraft: "",
  finalAnswer: "",
};

describe("knowledge workflow graph", () => {
  it("routes direct questions to fast_qa", async () => {
    const result = await routeTask({
      ...baseState,
      userQuestion: "年假多少天",
      normalizedQuestion: "年假多少天",
    });
    expect(result.route).toBe("fast_qa");
  });

  it("routes comparison questions to workflow_qa", async () => {
    const result = await routeTask({
      ...baseState,
      userQuestion: "对比入职和转正流程的差异",
      normalizedQuestion: "对比入职和转正流程的差异",
    });
    expect(result.route).toBe("workflow_qa");
  });
});
