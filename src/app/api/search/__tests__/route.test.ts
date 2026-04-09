import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock 所有外部依赖 ──────────────────────────────
vi.mock("@/lib/supabaseServer", () => ({
  getSupabaseServerClient: vi.fn(),
}));
vi.mock("@/lib/embedClient", () => ({
  getEmbeddings: vi.fn(),
}));
vi.mock("@/lib/ai-client", () => ({
  getAIClient: vi.fn(),
  AI_MODEL: "test-model",
}));
vi.mock("@/lib/workspace", () => ({
  resolveWorkspaceId: vi.fn().mockResolvedValue("ws-test"),
}));
vi.mock("@/lib/promptTemplate", () => ({
  DEFAULT_SYSTEM_PROMPT: "你是测试助手",
  getActivePromptTemplate: vi.fn(() => null),
  getPromptTemplateByVersion: vi.fn(() => null),
}));
vi.mock("@/lib/runtimeGuards", () => ({
  enforceSearchRateLimit: vi.fn(() => ({ ok: true })),
  buildSearchCacheKey: vi.fn(() => "cache-key"),
  getCachedSearchAnswer: vi.fn(() => null),
  setCachedSearchAnswer: vi.fn(),
}));
vi.mock("@/lib/queryRewrite", () => ({
  rewriteQuery: vi.fn(async (q: string) => ({ rewritten: q, original: q })),
}));
vi.mock("@/lib/reranker", () => ({
  rerankChunks: vi.fn(async (_q: string, chunks: unknown[]) => chunks),
}));

import { POST } from "../route";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import { getEmbeddings } from "@/lib/embedClient";
import { getAIClient } from "@/lib/ai-client";
import { enforceSearchRateLimit } from "@/lib/runtimeGuards";

// ── Helpers ─────────────────────────────────────────

/** 构造 POST 请求 */
function makeRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** 读取 JSONL 流，返回所有事件 */
async function consumeStream(response: Response) {
  const text = await response.text();
  return text
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line));
}

/** 模拟 OpenAI streaming 返回的 async iterable */
function createMockCompletion(tokens: string[]) {
  return (async function* () {
    for (const text of tokens) {
      yield { choices: [{ delta: { content: text } }] };
    }
  })();
}

// ── Setup ───────────────────────────────────────────

function setupMocks(options?: {
  matches?: Array<{ id: number; document_id: number; content: string; similarity: number }>;
  tokens?: string[];
}) {
  const matches = options?.matches ?? [
    { id: 1, document_id: 1, content: "企业年假制度为每年15天", similarity: 0.85 },
  ];
  const tokens = options?.tokens ?? ["年假", "是", "15天"];

  // Supabase mock
  const mockInsert = vi.fn().mockReturnValue({ data: null, error: null });
  vi.mocked(getSupabaseServerClient).mockResolvedValue({
    rpc: vi.fn().mockResolvedValue({ data: matches, error: null }),
    from: vi.fn().mockReturnValue({ insert: mockInsert }),
  } as unknown as Awaited<ReturnType<typeof getSupabaseServerClient>>);

  // Embeddings mock
  vi.mocked(getEmbeddings).mockReturnValue({
    embedDocuments: vi.fn().mockResolvedValue([[0.1, 0.2, 0.3]]),
  } as unknown as ReturnType<typeof getEmbeddings>);

  // AI client mock
  vi.mocked(getAIClient).mockReturnValue({
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue(createMockCompletion(tokens)),
      },
    },
  } as unknown as ReturnType<typeof getAIClient>);

  return { mockInsert };
}

// ── Tests ───────────────────────────────────────────

describe("POST /api/search", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(enforceSearchRateLimit).mockReturnValue({ ok: true });
  });

  it("空 question 应返回 400", async () => {
    const res = await POST(makeRequest({ question: "" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/Missing question/i);
  });

  it("无 question 字段应返回 400", async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it("限流触发应返回 429", async () => {
    vi.mocked(enforceSearchRateLimit).mockReturnValue({
      ok: false,
      errorCode: "RATE_LIMIT_MINUTE",
      message: "请求过于频繁",
    });

    const res = await POST(makeRequest({ question: "测试" }));
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.errorCode).toBe("RATE_LIMIT_MINUTE");
  });

  it("happy path：JSONL 流应包含 step / sources / delta 事件", async () => {
    setupMocks();

    const res = await POST(makeRequest({ question: "年假多少天" }));
    expect(res.status).toBe(200);

    const events = await consumeStream(res);

    const types = events.map((e) => e.type);
    expect(types).toContain("step");
    expect(types).toContain("sources");
    expect(types).toContain("delta");

    // 验证 sources 包含检索结果
    const sourcesEvent = events.find((e) => e.type === "sources");
    expect(sourcesEvent.data).toHaveLength(1);
    expect(sourcesEvent.data[0].similarity).toBe(0.85);

    // 验证 delta 拼接后是完整回答
    const deltas = events.filter((e) => e.type === "delta").map((e) => e.data);
    expect(deltas.join("")).toBe("年假是15天");
  });

  it("无匹配文档应返回固定提示", async () => {
    setupMocks({ matches: [] });

    const res = await POST(makeRequest({ question: "不相关的问题" }));
    const events = await consumeStream(res);

    const deltas = events.filter((e) => e.type === "delta").map((e) => e.data);
    expect(deltas.join("")).toContain("文档中未提及相关信息");
  });

  it("run_history 应被写入", async () => {
    const { mockInsert } = setupMocks();

    const res = await POST(makeRequest({ question: "测试记录" }));
    await consumeStream(res); // 必须消费 stream，flushRunHistory 才会执行

    expect(mockInsert).toHaveBeenCalledTimes(1);

    const insertArg = mockInsert.mock.calls[0][0];
    expect(insertArg.question).toBe("测试记录");
    expect(insertArg.request_id).toBeTruthy();
  });
});
