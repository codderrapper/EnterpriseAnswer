/**
 * ⭐ 面试亮点（/api/runs/[id]）：
 * 1. 返回单次运行的完整上下文：question / answer / steps / sources / 参数 / 耗时，用于前端做 Trace 回放。
 * 2. steps & sources 使用 jsonb 存储，方便扩展字段，不影响 schema。
 */

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  ctx: { params: { id: string } }
) {
  try {
    const runId = Number(ctx.params.id);
    if (!Number.isFinite(runId)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("run_history")
      .select("*")
      .eq("id", runId)
      .single();

    if (error) {
      console.error("❌ fetch run detail error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json(
        { error: "Run not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(data);
  } catch (err: any) {
    console.error("❌ run detail route error:", err);
    return NextResponse.json(
      { error: err?.message || "Server error" },
      { status: 500 }
    );
  }
}
