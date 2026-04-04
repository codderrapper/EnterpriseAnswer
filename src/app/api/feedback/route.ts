import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseClient } from "@/lib/supabaseClient";

export const runtime = "nodejs";

const FeedbackInputSchema = z.object({
  runId: z.number().int().positive("runId is required"),
  vote: z.enum(["up", "down"], { message: "vote must be up/down" }).optional(),
  isHallucination: z.boolean().default(false),
  note: z.string().trim().default(""),
});

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const runId = Number(searchParams.get("runId") || "0");

    if (!Number.isFinite(runId) || runId <= 0) {
      return NextResponse.json(
        { error: "runId is required", errorCode: "INVALID_PAYLOAD" },
        { status: 400 },
      );
    }

    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from("answer_feedback")
      .select("id,run_id,vote,is_hallucination,note,created_at")
      .eq("run_id", runId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { error: error.message, errorCode: "FEEDBACK_FETCH_ERROR" },
        { status: 500 },
      );
    }

    return NextResponse.json({ item: data ?? null });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Server error", errorCode: "SERVER_ERROR" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const parsed = FeedbackInputSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid payload", errorCode: "INVALID_PAYLOAD" },
        { status: 400 },
      );
    }
    
    const { runId, vote, isHallucination, note } = parsed.data;

    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from("answer_feedback")
      .insert({
        run_id: runId,
        vote,
        is_hallucination: isHallucination,
        note: note || null,
      })
      .select("id,run_id,vote,is_hallucination,note,created_at")
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message, errorCode: "FEEDBACK_INSERT_ERROR" },
        { status: 500 },
      );
    }

    return NextResponse.json({ item: data });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Server error", errorCode: "SERVER_ERROR" },
      { status: 500 },
    );
  }
}
