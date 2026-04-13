import { rerankChunks, type RerankItem } from "@/lib/reranker";
import type { EvidenceDoc } from "../types";

export async function rerankEvidence(
  question: string,
  docs: EvidenceDoc[],
): Promise<EvidenceDoc[]> {
  if (docs.length <= 1) return docs;

  // Map EvidenceDoc → RerankItem (id must be number, document_id required)
  const rerankItems: RerankItem[] = docs.map((doc) => ({
    id: Number(doc.id),
    document_id: doc.documentId ?? 0,
    content: doc.content,
    similarity: doc.similarity,
  }));

  const reranked = await rerankChunks(question, rerankItems);

  // Map reranked items back to EvidenceDoc
  // Note: id coercion (string→number→string) only works while normalizeMatchRow
  // produces numeric string IDs. If that changes, update this mapping.
  return reranked.map((item): EvidenceDoc => {
    const original = docs.find((d) => Number(d.id) === item.id);
    const score = item.relevanceScore ?? 0;
    const relevance: EvidenceDoc["relevance"] =
      score >= 6 ? "relevant" : score >= 3 ? "partial" : "irrelevant";
    return {
      id: String(item.id),
      documentId: original?.documentId ?? item.document_id,
      content: item.content,
      similarity: original?.similarity,
      relevance,
    };
  });
}
