import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";
import { embeddings } from "@/lib/embedClient";

export const runtime = "nodejs";

// 🔹 Helper function to split long text into overlapping chunks
function splitText(text: string, chunkSize = 500, overlap = 50) {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += chunkSize - overlap) {
    chunks.push(text.slice(i, i + chunkSize));
  }
  return chunks;
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) throw new Error("No file uploaded");

    // 🧠 Read file content
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // ✅ Only allow .txt or .md
    if (!file.name.endsWith(".txt") && !file.name.endsWith(".md")) {
      return NextResponse.json(
        { error: "Only .txt or .md supported" },
        { status: 400 }
      );
    }

    const text = buffer.toString("utf-8");
    console.log("✅ Extracted text preview:", text.slice(0, 100));

    // 🧱 Step 1: Save the original document
    const { data: docData, error: docErr } = await supabase
      .from("documents")
      .insert({ name: file.name, content: text })
      .select("id")
      .single();

    if (docErr) throw docErr;
    const documentId = docData.id;
    console.log('docData: ', docData);
    console.log("📄 Document inserted:", documentId);

    // 🧩 Step 2: Split into chunks
    const chunks = splitText(text);
    console.log('chunks: ', chunks);
    console.log("🪣 Split into", chunks.length, "chunks");

    // 🧠 Step 3: Create embeddings for each chunk
    for (const chunk of chunks) {
      try {
        const [vector] = await embeddings.embedDocuments([chunk]);
        console.log('vector: ', vector);

        const res = await supabase.from("document_chunks").insert({
          document_id: documentId,
          content: chunk,
          embedding: vector,
        });
        console.log('res: ', res);  

        if (res.error) console.error("❌ Chunk insert error:", res.error);
      } catch (e) {
        console.error("❌ Embedding error:", e);
      }
    }

    // ✅ Return success
    return NextResponse.json({
      message: "File uploaded and embedded successfully!",
      filename: file.name,
      chunks: chunks.length,
    });
  } catch (err: any) {
    console.error("❌ Upload error:", err);
    return NextResponse.json(
      { error: err.message || "Upload failed" },
      { status: 500 }
    );
  }
}
