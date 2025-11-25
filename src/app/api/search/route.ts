import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";
import { embeddings } from "@/lib/embedClient";
import { aiClient, AI_MODEL } from "@/lib/ai-client"; // your normal chat client

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { question } = await req.json();
    console.log("question: ", question);
    if (!question) throw new Error("Missing question");

    // 1️⃣ Embed the question
    const [queryVector] = await embeddings.embedDocuments([question]);
    console.log("queryVector: ", queryVector);

    // 2️⃣ Query Supabase for most similar chunks
    const { data: matches, error } = await supabase.rpc("match_documents", {
      query_embedding: queryVector,
      match_threshold: 0.4, // optional: filter by similarity
      match_count: 5, // how many chunks to return
    });

    console.log("matches: ", matches);
    if (error) throw error;
    if (!matches || matches.length === 0)
      return NextResponse.json({ answer: "No relevant info found." });

    // 3️⃣ Build context string
    const context = matches.map((m: any) => m.content).join("\n---\n");

    // 4️⃣ Ask the LLM with retrieved context
    const prompt = `
        你是一名企业知识问答助手，请根据以下提供的文档内容，用简洁、正式的中文回答问题。
        如果找不到答案，请直接回复：“文档中未提及相关信息。”

        请仅输出核心答案，不要重复文档原文。

        【文档内容】
        ${context}

        【问题】
        ${question}

        请输出格式如下：
        答案：<简短回答>
        来源：<文档编号或标题（如有）>
        `;

    const completion = await aiClient.chat.completions.create({
      model: AI_MODEL,
      messages: [{ role: "user", content: prompt }],
      stream: true,
    });

    console.log("completion: ", completion);

    return new Response(
      new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder();
          for await (const chunk of completion) {
            const content = chunk.choices?.[0]?.delta?.content;
            if (content) controller.enqueue(encoder.encode(content));
          }
          controller.close();
        },
      }),
      { headers: { "Content-Type": "text/plain; charset=utf-8" } }
    );

    // const answer = completion.choices[0].message?.content || "No answer.";
    // const answer = (completion.choices[0].message?.content || "No answer.")
    //   .trim()
    //   .replace(/^\n+/, "");
    // console.log("answer: ", answer);
    // // return NextResponse.json({ answer, matches });
    // return NextResponse.json({
    //   answer,
    //   sources: matches.map((m: any) => ({
    //     id: m.chunk_id,
    //     document_id: m.document_id,
    //     snippet: m.content.slice(0, 120) + "...", // short preview only
    //     similarity: m.similarity.toFixed(3),
    //   })),
    // });
  } catch (err: any) {
    console.error("❌ Search error:", err);
    return NextResponse.json({ error: err.message || "fail" }, { status: 500 });
  }
}
