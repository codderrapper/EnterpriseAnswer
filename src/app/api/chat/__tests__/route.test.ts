import { describe, expect, it, vi } from "vitest";

// Mock dependencies
vi.mock("@/lib/supabaseServer", () => ({
  getSupabaseServerClient: vi.fn().mockResolvedValue({
    rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({ data: [], error: null })),
      })),
    })),
  }),
}));

vi.mock("@/lib/workspace", () => ({
  resolveWorkspaceId: vi.fn().mockResolvedValue("ws-test"),
}));

vi.mock("@/features/knowledge-workflow/server/graph", () => ({
  createKnowledgeWorkflowGraph: vi.fn(() => ({
    invoke: vi.fn().mockResolvedValue({
      finalAnswer: "Test answer",
      route: "fast_qa",
      retrievedDocs: [],
      rerankedDocs: [],
      selectedEvidence: [],
    }),
  })),
}));

describe("POST /api/chat", () => {
  it("opens a streaming response", async () => {
    const { POST } = await import("../route");
    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: "年假多少天" }],
      }),
    });

    const response = await POST(req);
    expect(response.status).toBe(200);
    // UI Message Stream Response has content-type text/plain or application/octet-stream
    expect(response.headers.get("content-type")).toBeTruthy();
  });

  it("returns 400 for missing messages", async () => {
    const { POST } = await import("../route");
    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    const response = await POST(req);
    expect(response.status).toBe(400);
  });

  it("returns 400 when no user message found", async () => {
    const { POST } = await import("../route");
    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "assistant", content: "Hello" }],
      }),
    });

    const response = await POST(req);
    expect(response.status).toBe(400);
  });
});
