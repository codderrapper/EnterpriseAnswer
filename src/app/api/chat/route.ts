import { createUIMessageStream, createUIMessageStreamResponse } from "ai";
import { z } from "zod";
import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import { resolveWorkspaceId } from "@/lib/workspace";
import { createKnowledgeWorkflowGraph } from "@/features/knowledge-workflow/server/graph";
import type { WorkflowEvent } from "@/features/knowledge-workflow/server/events";

export const runtime = "nodejs";

const ChatInputSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      }),
    )
    .min(1),
});

export async function POST(req: Request) {
  const parsed = ChatInputSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const lastUserMessage = [...parsed.data.messages]
    .reverse()
    .find((m) => m.role === "user");
  if (!lastUserMessage) {
    return NextResponse.json({ error: "No user message" }, { status: 400 });
  }

  const supabase = await getSupabaseServerClient();
  const workspaceId = await resolveWorkspaceId(supabase);
  const requestId = crypto.randomUUID();

  const graph = createKnowledgeWorkflowGraph();

  return createUIMessageStreamResponse({
    stream: createUIMessageStream({
      execute: async ({ writer }) => {
        const send = (event: WorkflowEvent) => {
          writer.write(event as never);
        };

        const result = await graph.invoke(
          {
            userQuestion: lastUserMessage.content,
            normalizedQuestion: "",
            workspaceId,
            rewriteCount: 0,
            retrievedDocs: [],
            rerankedDocs: [],
            selectedEvidence: [],
            answerDraft: "",
            finalAnswer: "",
          },
          { configurable: { supabase, send, requestId } },
        );

        // Write the final answer as text delta chunks
        if (result.finalAnswer) {
          const textId = crypto.randomUUID();
          writer.write({ type: "text-start", id: textId } as never);
          writer.write({
            type: "text-delta",
            id: textId,
            delta: result.finalAnswer,
          } as never);
          writer.write({ type: "text-end", id: textId } as never);
        }
      },
      onError: (error: unknown) => {
        console.error("[chat] stream error:", error);
        return error instanceof Error ? error.message : "Stream error";
      },
    }),
  });
}
