import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock 外部依赖 ──────────────────────────────────
vi.mock("@/lib/supabaseClient", () => ({
  getSupabaseClient: vi.fn(),
}));
vi.mock("@/lib/embedClient", () => ({
  getEmbeddings: vi.fn(),
}));

import { POST } from "../route";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { getEmbeddings } from "@/lib/embedClient";

// ── Helpers ─────────────────────────────────────────

/** 构造带文件的 FormData 请求 */
function makeUploadRequest(content: string, filename: string) {
  const formData = new FormData();
  const blob = new Blob([content], { type: "text/plain" });
  formData.append("file", blob, filename);
  return new Request("http://localhost/api/upload", {
    method: "POST",
    body: formData,
  });
}

/** 构造空 FormData 请求（无文件） */
function makeEmptyRequest() {
  const formData = new FormData();
  return new Request("http://localhost/api/upload", {
    method: "POST",
    body: formData,
  });
}

// ── Setup ───────────────────────────────────────────

function setupMocks() {
  const mockSingle = vi.fn().mockReturnValue({
    data: { id: 42 },
    error: null,
  });
  const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
  const mockDocInsert = vi.fn().mockReturnValue({ select: mockSelect });
  const mockChunkInsert = vi.fn().mockReturnValue({ data: null, error: null });

  vi.mocked(getSupabaseClient).mockReturnValue({
    from: vi.fn((table: string) => {
      if (table === "documents") return { insert: mockDocInsert };
      if (table === "document_chunks") return { insert: mockChunkInsert };
      return { insert: vi.fn() };
    }),
  } as ReturnType<typeof getSupabaseClient>);

  vi.mocked(getEmbeddings).mockReturnValue({
    embedDocuments: vi.fn().mockResolvedValue([[0.1, 0.2, 0.3]]),
  } as ReturnType<typeof getEmbeddings>);

  return { mockDocInsert, mockChunkInsert };
}

// ── Tests ───────────────────────────────────────────

describe("POST /api/upload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("非 txt/md 文件应返回 400", async () => {
    const req = makeUploadRequest("hello", "report.pdf");
    const res = await POST(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/\.txt or \.md/i);
  });

  it("无文件应返回 500", async () => {
    const res = await POST(makeEmptyRequest());

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/No file/i);
  });

  it("txt 文件上传成功", async () => {
    const { mockDocInsert, mockChunkInsert } = setupMocks();

    const content = "这是测试文档内容";
    const res = await POST(makeUploadRequest(content, "test.txt"));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.filename).toBe("test.txt");
    expect(body.chunks).toBeGreaterThan(0);

    // 验证文档被插入
    expect(mockDocInsert).toHaveBeenCalledTimes(1);
    expect(mockDocInsert.mock.calls[0][0]).toMatchObject({
      name: "test.txt",
      content,
    });
  });

  it("md 文件上传成功", async () => {
    setupMocks();

    const res = await POST(makeUploadRequest("# Title\nBody", "readme.md"));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.filename).toBe("readme.md");
  });

  it("长文本应被分片并逐个 embedding", async () => {
    const { mockChunkInsert } = setupMocks();

    // 1200 字符，默认 500/50 → 3 个 chunk
    const longText = "x".repeat(1200);
    const res = await POST(makeUploadRequest(longText, "long.txt"));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.chunks).toBe(3);

    // 每个 chunk 都调用了 insert
    expect(mockChunkInsert).toHaveBeenCalledTimes(3);
  });
});
