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

  // Map back: preserve all EvidenceDoc fields, patch in relevanceScore → relevance label
  return reranked.map((item, index): EvidenceDoc => {
    // Find the original doc by id to carry forward fields like `relevance`
    const original = docs.find((d) => Number(d.id) === item.id) ?? docs[index];
    const score = item.relevanceScore ?? 0;
    const relevance: EvidenceDoc["relevance"] =
      score >= 6 ? "relevant" : score >= 3 ? "partial" : "irrelevant";

    return {
      ...original,
      similarity: item.similarity ?? original.similarity,
      relevance,
    };
  });
}
