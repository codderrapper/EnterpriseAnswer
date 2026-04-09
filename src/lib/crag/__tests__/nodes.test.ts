import { describe, it, expect, vi, beforeEach } from "vitest";
import type { CragState, SendFn, Chunk } from "../types";

// stable mock instance so tests can call mockResolvedValueOnce on the same fn
const mockCreate = vi.fn().mockResolvedValue({
  choices: [{
    message: {
      content: JSON.stringify({
        grades: [
          { id: "1", relevance: "relevant",   confidence: 0.9, reason: "直接相关" },
          { id: "2", relevance: "irrelevant", confidence: 0.8, reason: "不相关" },
        ]
      })
    }
  }]
});

const mockAIClient = {
  chat: { completions: { create: mockCreate } },
};

// mock AI client
vi.mock("@/lib/ai-client", () => ({
  getAIClient: () => mockAIClient,
  AI_MODEL: "gpt-4o-mini",
}));

vi.mock("@/lib/embedClient", () => ({
  getEmbeddings: () => ({ embedDocuments: vi.fn().mockResolvedValue([[0.1, 0.2]]) }),
}));
vi.mock("@/lib/queryRewrite", () => ({
  rewriteQuery: vi.fn().mockResolvedValue({ rewritten: "年假 申请 流程", original: "年假怎么申请" }),
}));

const makeState = (overrides: Partial<CragState> = {}): CragState => ({
  workspaceId: "demo-ws",
  originalQuestion: "年假怎么申请",
  activeQuery: "年假怎么申请",
  queryHistory: [],
  retryCount: 0,
  topK: 5,
  threshold: 0.5,
  retrievedDocs: [],
  gradedDocs: [],
  selectedDocs: [],
  decision: undefined,
  answer: "",
  fallbackMessage: undefined,
  ...overrides,
});

const makeConfig = (send: SendFn = vi.fn()) => ({ configurable: { send } });

// ─── gradeDocumentsNode ───────────────────────────────────────────────────────

describe("gradeDocumentsNode", () => {
  it("routes to generate when at least 1 relevant chunk found", async () => {
    const { gradeDocumentsNode } = await import("../nodes");
    const chunks: Chunk[] = [
      { id: "1", content: "年假申请流程...", metadata: { similarity: 0.9 } },
      { id: "2", content: "着装规范...",     metadata: { similarity: 0.6 } },
    ];
    const state = makeState({ retrievedDocs: chunks });
    const result = await gradeDocumentsNode(state, makeConfig());

    expect(result.decision?.route).toBe("generate");
    expect(result.gradedDocs).toHaveLength(2);
    expect(result.selectedDocs?.some(d => d.id === "1")).toBe(true);
    expect(result.selectedDocs?.every(d => d.id !== "2")).toBe(true);
  });

  it("routes to rewrite when no relevant chunks and retryCount < 2", async () => {
    const { gradeDocumentsNode } = await import("../nodes");
    mockCreate.mockResolvedValueOnce({
      choices: [{
        message: {
          content: JSON.stringify({
            grades: [{ id: "1", relevance: "irrelevant", confidence: 0.9, reason: "不相关" }]
          })
        }
      }]
    });

    const chunks: Chunk[] = [{ id: "1", content: "着装规范...", metadata: {} }];
    const state = makeState({ retrievedDocs: chunks, retryCount: 0 });
    const result = await gradeDocumentsNode(state, makeConfig());

    expect(result.decision?.route).toBe("rewrite");
  });

  it("routes to fallback when retryCount >= 2", async () => {
    const { gradeDocumentsNode } = await import("../nodes");
    const state = makeState({ retrievedDocs: [], retryCount: 2 });
    const result = await gradeDocumentsNode(state, makeConfig());
    expect(result.decision?.route).toBe("fallback");
  });

  it("emits node_started and node_completed events", async () => {
    const { gradeDocumentsNode } = await import("../nodes");
    const send = vi.fn();
    const state = makeState({ retrievedDocs: [] });
    await gradeDocumentsNode(state, makeConfig(send));

    const types = send.mock.calls.map((c: unknown[]) => (c[0] as { type: string }).type);
    expect(types).toContain("node_started");
    expect(types).toContain("node_completed");
    expect(send.mock.calls[0][0].node).toBe("gradeDocuments");
  });
});

// ─── rewriteQueryNode ─────────────────────────────────────────────────────────

describe("rewriteQueryNode", () => {
  it("increments retryCount and updates activeQuery", async () => {
    const { rewriteQueryNode } = await import("../nodes");
    const state = makeState({ activeQuery: "年假", retryCount: 0 });
    const result = await rewriteQueryNode(state, makeConfig());
    expect(result.retryCount).toBe(1);
    expect(typeof result.activeQuery).toBe("string");
    expect(result.queryHistory?.length).toBeGreaterThan(0);
  });

  it("returns queryHistory with only the new rewritten query (not full array)", async () => {
    const { rewriteQueryNode } = await import("../nodes");
    const state = makeState({ activeQuery: "年假", queryHistory: ["previous"], retryCount: 1 });
    const result = await rewriteQueryNode(state, makeConfig());
    // Should return [newQuery] not [previous, newQuery] — reducer handles appending
    expect(result.queryHistory).toHaveLength(1);
  });
});

// ─── fallbackNode ─────────────────────────────────────────────────────────────

describe("fallbackNode", () => {
  it("returns a non-empty fallbackMessage and answer", async () => {
    const { fallbackNode } = await import("../nodes");
    const state = makeState({ retryCount: 2 });
    const result = await fallbackNode(state, makeConfig());
    expect(result.fallbackMessage).toBeTruthy();
    expect(result.answer).toBeTruthy();
  });

  it("emits node_started and node_completed", async () => {
    const { fallbackNode } = await import("../nodes");
    const send = vi.fn();
    await fallbackNode(makeState(), makeConfig(send));
    const types = send.mock.calls.map((c: unknown[]) => (c[0] as { type: string }).type);
    expect(types).toContain("node_started");
    expect(types).toContain("node_completed");
  });
});
