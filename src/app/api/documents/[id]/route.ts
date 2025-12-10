/**
 * ⭐ 面试亮点（/api/documents/[id]）：
 * 1. 针对 RAG 文档系统设计了“单文档详情接口”，一次返回文档原文 + 所有分片内容，用于构建可视化调试视图。
 * 2. 完全基于真实表结构（documents + document_chunks），体现对底层存储结构的理解，而不是停留在向量检索黑盒。
 * 3. 为前端“文档详情页 + chunk 高亮 + 来源跳转”提供统一数据源。
 */

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export const runtime = "nodejs";

type DocumentRow = {
  id: number;
  name: string;
  content: string;
  created_at: string;
};

type ChunkRow = {
  id: number;
  document_id: number;
  content: string;
};

export async function GET(
  req: NextRequest,
  ctx: { params: { id: string } }
) {
  try {
    const docId = Number(ctx.params.id);
    if (!Number.isFinite(docId)) {
      return NextResponse.json({ error: "Invalid document id" }, { status: 400 });
    }

    // 1️⃣ 查询文档主信息
    const { data: doc, error: docError } = await supabase
      .from("documents")
      .select("*")
      .eq("id", docId)
      .single();

    if (docError) {
      console.error("❌ fetch document error:", docError);
      return NextResponse.json({ error: docError.message }, { status: 500 });
    }

    if (!doc) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    // 2️⃣ 查询该文档的所有 chunk
    const { data: rawChunks, error: chunksError } = await supabase
      .from("document_chunks")
      .select("*")
      .eq("document_id", docId)
      .order("id", { ascending: true });

    if (chunksError) {
      console.error("❌ fetch chunks error:", chunksError);
      return NextResponse.json({ error: chunksError.message }, { status: 500 });
    }

    const chunks = (rawChunks ?? []) as ChunkRow[];

    return NextResponse.json({
      document: doc as DocumentRow,
      chunks,
    });
  } catch (err: any) {
    console.error("❌ document detail route error:", err);
    return NextResponse.json(
      { error: err?.message || "Server error" },
      { status: 500 }
    );
  }
}
