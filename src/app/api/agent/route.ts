// src/app/api/agent/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { cragGraph, makeCragInitialState } from "@/lib/crag/graph";
import type { AgentEvent } from "@/lib/crag/types";
import { getSupabaseClient } from "@/lib/supabaseClient";

export const runtime = "nodejs";

const AgentInputSchema = z.object({
  question:  z.string().min(1, "Missing question"),
  topK:      z.number().int().min(1).max(20).default(5),
  threshold: z.number().min(0).max(1).default(0.5),
});

export async function POST(req: Request) {
  const parsed = AgentInputSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const { question, topK, threshold } = parsed.data;
  const encoder = new TextEncoder();
  const t0 = Date.now();

  // The send callback drives the JSONL stream. Each node calls send() synchronously
  // from within graph.invoke(), which enqueues bytes directly into the ReadableStream.
  // This means token streaming works without any special LangGraph stream mode —
  // generateNode calls send({type:"token"}) in its LLM for-await loop.
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: AgentEvent) => {
        controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      };

      try {
        const initialState = makeCragInitialState(question, topK, threshold);

        const result = await cragGraph.invoke(initialState, {
          configurable: { send },
        });

        const supabase = getSupabaseClient();
        const { data: run } = await supabase
          .from("agent_runs")
          .insert({
            question,
            active_query:  result.activeQuery  as string,
            retry_count:   result.retryCount   as number,
            route:         (result.decision as { route: string } | undefined)?.route ?? "fallback",
            answer:        result.answer       as string,
            graded_docs:   result.gradedDocs,
            selected_docs: result.selectedDocs,
            decision:      result.decision,
            duration_ms:   Date.now() - t0,
          })
          .select("id")
          .single();

        send({ type: "run_completed", runId: (run as { id: number } | null)?.id ?? 0 });
      } catch (err) {
        send({ type: "error", message: err instanceof Error ? err.message : String(err) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
