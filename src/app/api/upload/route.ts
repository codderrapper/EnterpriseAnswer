import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { getEmbeddings } from "@/lib/embedClient";
import { splitText } from "@/lib/textChunker";
import { getDemoWorkspaceIdOrThrow } from "@/lib/demoWorkspace";

export const runtime = "nodejs";

/** 支持的文件扩展名 */
const SUPPORTED_EXTENSIONS = [".txt", ".md", ".pdf"];

/** 上传文件大小上限：10 MB */
const MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * 从 PDF Buffer 中提取纯文本。
 * pdf-parse v2 使用 class-based API。
 */
async function extractPdfText(buffer: Buffer): Promise<string> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  const result = await parser.getText();
  await parser.destroy();
  return result.text;
}

/**
 * 根据文件扩展名提取文本内容。
 * - .txt / .md → 直接 UTF-8 解码
 * - .pdf → 用 pdf-parse 提取
 */
async function extractText(buffer: Buffer, filename: string): Promise<string> {
  if (filename.endsWith(".pdf")) {
    return extractPdfText(buffer);
  }
  return buffer.toString("utf-8");
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) throw new Error("No file uploaded");

    const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    if (!SUPPORTED_EXTENSIONS.includes(ext)) {
      return NextResponse.json(
        { error: `Only ${SUPPORTED_EXTENSIONS.join(", ")} supported` },
        { status: 400 },
      );
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File too large (max 10MB)" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // 提取文本（PDF 走 pdf-parse，其余 UTF-8 直接读）
    const text = await extractText(buffer, file.name);
    if (!text.trim()) {
      return NextResponse.json(
        { error: "File content is empty" },
        { status: 400 },
      );
    }
    console.log("✅ Extracted text preview:", text.slice(0, 100));

    const supabase = getSupabaseClient();
    const workspaceId = getDemoWorkspaceIdOrThrow();

    // Step 1: 保存原始文档
    const { data: docData, error: docErr } = await supabase
      .from("documents")
      .insert({ name: file.name, content: text, workspace_id: workspaceId })
      .select("id")
      .single();

    if (docErr) throw docErr;
    const documentId = docData.id;
    console.log("📄 Document inserted:", documentId);

    // Step 2: 分片
    const chunks = splitText(text);
    console.log("🪣 Split into", chunks.length, "chunks");

    // Step 3: 逐个 embedding 并存入 document_chunks
    for (const chunk of chunks) {
      try {
        const embeddings = getEmbeddings();
        const [vector] = await embeddings.embedDocuments([chunk]);

        const res = await supabase.from("document_chunks").insert({
          document_id: documentId,
          content: chunk,
          embedding: vector,
        });

        if (res.error) console.error("❌ Chunk insert error:", res.error);
      } catch (e) {
        console.error("❌ Embedding error:", e);
      }
    }

    return NextResponse.json({
      message: "File uploaded and embedded successfully!",
      filename: file.name,
      chunks: chunks.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    console.error("❌ Upload error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
