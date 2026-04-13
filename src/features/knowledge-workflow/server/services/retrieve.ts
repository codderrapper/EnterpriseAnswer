import type { EvidenceDoc } from "../types";
import { getEmbeddings } from "@/lib/embedClient";

type SupabaseClient = Awaited<ReturnType<typeof import("@/lib/supabaseServer").getSupabaseServerClient>>;

/** Raw row returned by the match_documents RPC. */
type MatchRow = {
  id: number;
  document_id: number;
  content: string;
  similarity?: number;
  score?: number;
};

/**
 * Normalize a raw match_documents RPC row into an EvidenceDoc.
 * Exported so it can be unit-tested without a real Supabase connection.
 */
export function normalizeMatchRow(row: MatchRow): EvidenceDoc {
  const sim = Number(row.similarity ?? row.score ?? 0);
  return {
    id: String(row.id),
    documentId: Number(row.document_id),
    content: String(row.content ?? ""),
    similarity: Number.isFinite(sim) ? sim : 0,
  };
}

export async function retrieveEvidence(params: {
  question: string;
  workspaceId: string;
  supabase: SupabaseClient;
  topK?: number;
  threshold?: number;
}): Promise<EvidenceDoc[]> {
  const { question, workspaceId, supabase, topK = 5, threshold = 0.4 } = params;

  const embeddings = getEmbeddings();
  const queryVector = await embeddings.embedQuery(question);

  const { data, error } = await supabase.rpc("match_documents", {
    query_embedding: queryVector,
    match_threshold: threshold,
    match_count: topK,
    p_workspace_id: workspaceId,
  });

  if (error) throw error;

  return ((data ?? []) as MatchRow[])
    .map(normalizeMatchRow)
    .filter((doc) => doc.content.length > 0)
    .sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0));
}
