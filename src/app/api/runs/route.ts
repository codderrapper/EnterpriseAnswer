/**
 * ⭐ 面试亮点（/api/runs）：
 * 1. 提供运行历史分页查询接口，为前端构建“AI 调用观测面板”提供数据基础。
 * 2. 返回 question/answer 预览、RAG 参数、命中数量、耗时等字段，方便做效果分析与排查。
 */

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export const runtime = "nodejs";

type RunListItem = {
  id: number;
  question: string;
  answer: string | null;
  topk: number | null;
  threshold: number | null;
  matched_count: number | null;
  duration_ms: number | null;
  created_at: string;
};

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const page = Number(searchParams.get("page") || "1");
    const pageSize = Number(searchParams.get("pageSize") || "20");

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, error, count } = await supabase
      .from("run_history")
      .select(
        "id, question, answer, topk, threshold, matched_count, duration_ms, created_at",
        { count: "exact" }
      )
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) {
      console.error("❌ fetch runs error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      items: (data ?? []) as RunListItem[],
      total: count ?? 0,
      page,
      pageSize,
    });
  } catch (err: any) {
    console.error("❌ runs route error:", err);
    return NextResponse.json(
      { error: err?.message || "Server error" },
      { status: 500 }
    );
  }
}
