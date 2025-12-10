/**
 * ⭐ 面试亮点（/api/documents）：
 * 1. 基于真实业务表结构（documents + document_chunks）设计了列表接口，支持搜索 + 分页。
 * 2. 通过二次查询 & JS 分组计算每个文档的分片数量（chunk_count），为 RAG 调试与文档质量评估提供基础数据。
 * 3. 返回结构清晰（items + total + page + pageSize），前端可以方便地用 SWR 做缓存和分页管理。
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

type DocumentListItem = {
  id: number;
  name: string;
  created_at: string;
  content_preview: string;
  chunk_count: number;
};

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const search = searchParams.get("search") || "";
    const page = Number(searchParams.get("page") || "1");
    const pageSize = Number(searchParams.get("pageSize") || "20");

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    // 1️⃣ 查询 documents
    let query = supabase
      .from("documents")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);

    if (search) {
      // 按 name 模糊搜索
      query = query.ilike("name", `%${search}%`);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error("❌ fetch documents error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const docs = (data ?? []) as DocumentRow[];

    // 如果当前页没有数据，直接返回空
    if (docs.length === 0) {
      return NextResponse.json({
        items: [] as DocumentListItem[],
        total: count ?? 0,
        page,
        pageSize,
      });
    }

    // 2️⃣ 查询当前页所有文档的 chunk 数量
    const docIds = docs.map((d) => d.id);

    const { data: chunkRows, error: chunkError } = await supabase
      .from("document_chunks")
      .select("id, document_id")
      .in("document_id", docIds);

    if (chunkError) {
      console.error("❌ fetch chunk counts error:", chunkError);
      // 这里不直接 fail，前端可以先展示基础信息
    }

    const chunkCountMap = new Map<number, number>();
    (chunkRows ?? []).forEach((row) => {
      const docId = (row as any).document_id as number;
      chunkCountMap.set(docId, (chunkCountMap.get(docId) ?? 0) + 1);
    });

    const items: DocumentListItem[] = docs.map((d) => ({
      id: d.id,
      name: d.name,
      created_at: d.created_at,
      content_preview: d.content.slice(0, 100),
      chunk_count: chunkCountMap.get(d.id) ?? 0,
    }));

    return NextResponse.json({
      items,
      total: count ?? 0,
      page,
      pageSize,
    });
  } catch (err: any) {
    console.error("❌ documents route error:", err);
    return NextResponse.json(
      { error: err?.message || "Server error" },
      { status: 500 }
    );
  }
}
