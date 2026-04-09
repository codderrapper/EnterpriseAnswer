import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/crag/graph", () => ({
  cragGraph: {
    invoke: vi.fn().mockImplementation(async (state: Record<string, unknown>, config: { configurable: { send: (e: unknown) => void } }) => {
      const send = config.configurable.send;
      send({ type: "node_started",   node: "retrieve",       ts: 1 });
      send({ type: "node_completed", node: "retrieve",       ts: 2, data: { node: "retrieve", count: 3, topSimilarity: 0.85 } });
      send({ type: "node_started",   node: "gradeDocuments", ts: 3 });
      send({ type: "node_completed", node: "gradeDocuments", ts: 4, data: { node: "gradeDocuments", relevant: 3, partial: 0, irrelevant: 0, route: "generate" } });
      send({ type: "node_started",   node: "generate",       ts: 5 });
      send({ type: "token", value: "年假" });
      send({ type: "token", value: "需要提前申请" });
      send({ type: "node_completed", node: "generate", ts: 6, data: { node: "generate", chars: 8 } });
      return {
        ...state,
        answer: "年假需要提前申请",
        activeQuery: state.originalQuestion,
        retryCount: 0,
        gradedDocs: [],
        selectedDocs: [],
        decision: { route: "generate", reason: "3 relevant" },
      };
    }),
  },
  makeCragInitialState: vi.fn((q: string, k: number, t: number, wid: string) => ({
    workspaceId: wid, originalQuestion: q, activeQuery: q, topK: k, threshold: t,
    queryHistory: [], retryCount: 0, retrievedDocs: [], gradedDocs: [],
    selectedDocs: [], decision: undefined, answer: "", fallbackMessage: undefined,
  })),
}));

vi.mock("@/lib/supabaseServer", () => ({
  getSupabaseServerClient: () => Promise.resolve({
    from: () => ({
      insert: () => ({
        select: () => ({
          single: () => Promise.resolve({ data: { id: 42 }, error: null }),
        }),
      }),
    }),
  }),
}));

vi.mock("@/lib/workspace", () => ({
  resolveWorkspaceId: vi.fn().mockResolvedValue("ws-test"),
}));

async function collectStream(res: Response): Promise<Array<Record<string, unknown>>> {
  const text = await res.text();
  return text.split("\n").filter(Boolean).map(line => JSON.parse(line));
}

describe("POST /api/agent", () => {
  it("returns 400 for missing question", async () => {
    const { POST } = await import("../route");
    const req = new Request("http://localhost/api/agent", {
      method: "POST",
      body: JSON.stringify({}),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("streams JSONL events including token and run_completed", async () => {
    const { POST } = await import("../route");
    const req = new Request("http://localhost/api/agent", {
      method: "POST",
      body: JSON.stringify({ question: "年假怎么申请" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);

    const events = await collectStream(res);
    const types = events.map(e => e.type);
    expect(types).toContain("node_started");
    expect(types).toContain("token");
    expect(types).toContain("run_completed");
  });

  it("run_completed event contains runId from DB", async () => {
    const { POST } = await import("../route");
    const req = new Request("http://localhost/api/agent", {
      method: "POST",
      body: JSON.stringify({ question: "年假" }),
    });
    const res = await POST(req);
    const events = await collectStream(res);
    const completed = events.find(e => e.type === "run_completed") as { runId: number } | undefined;
    expect(completed?.runId).toBe(42);
  });

  it("sends error event when graph throws", async () => {
    const { cragGraph } = await import("@/lib/crag/graph");
    vi.mocked(cragGraph.invoke).mockRejectedValueOnce(new Error("graph exploded"));
    const { POST } = await import("../route");
    const req = new Request("http://localhost/api/agent", {
      method: "POST",
      body: JSON.stringify({ question: "test error" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200); // stream always opens with 200
    const events = await collectStream(res);
    const errEvent = events.find(e => e.type === "error") as { type: string; message: string } | undefined;
    expect(errEvent?.message).toBe("graph exploded");
  });

  it("accepts topK and threshold overrides", async () => {
    const { POST } = await import("../route");
    const { makeCragInitialState } = await import("@/lib/crag/graph");
    const req = new Request("http://localhost/api/agent", {
      method: "POST",
      body: JSON.stringify({ question: "test", topK: 10, threshold: 0.7 }),
    });
    await POST(req);
    expect(vi.mocked(makeCragInitialState)).toHaveBeenCalledWith("test", 10, 0.7, "ws-test");
  });
});
