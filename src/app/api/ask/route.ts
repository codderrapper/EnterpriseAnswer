import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";
import { embeddings } from "@/lib/embedClient";
import { aiClient, AI_MODEL } from "@/lib/ai-client";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { question } = await req.json();
    if (!question) throw new Error("Missing question");

    // 1️⃣ Embed question
    const [queryVector] = await embeddings.embedDocuments([question]);

    // 2️⃣ Search similar chunks
    const { data: matches, error } = await supabase.rpc("match_documents", {
      query_embedding: queryVector,
      match_threshold: 0.4,
      match_count: 5,
    });
    if (error) throw error;

    if (!matches?.length)
      return new Response("No relevant info found.", { status: 200 });

    const context = matches.map((m: any) => m.content).join("\n---\n");

    const prompt = `
你是一名企业知识问答助手，请根据以下提供的文档内容，用简洁、正式的中文回答问题。
如果找不到答案，请直接回复：“文档中未提及相关信息。”

【文档内容】
${context}

【问题】
${question}
`;

    // 3️⃣ Start streaming response
    const completion = await aiClient.chat.completions.create({
      model: AI_MODEL,
      messages: [{ role: "user", content: prompt }],
      stream: true,
    });

    // 4️⃣ Build readable stream
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        // First send sources JSON
        const meta = JSON.stringify({ type: "sources", data: matches });
        controller.enqueue(encoder.encode(meta + "\n"));

        // Then stream the text
        for await (const chunk of completion) {
          const delta = chunk.choices?.[0]?.delta?.content;
          if (delta) {
            const msg = JSON.stringify({ type: "delta", data: delta });
            controller.enqueue(encoder.encode(msg + "\n"));
          }
        }

        controller.close();
      },
    });

    return new Response(stream, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (err: any) {
    console.error("❌ Search error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
