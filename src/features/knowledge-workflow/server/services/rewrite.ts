import { rewriteQuery } from "@/lib/queryRewrite";

export async function rewriteForRetrieval(
  question: string,
  model?: string,
): Promise<{ rewritten: string; original: string }> {
  return rewriteQuery(question, model);
}
