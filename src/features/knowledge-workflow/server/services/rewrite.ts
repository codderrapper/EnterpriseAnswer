import { rewriteQuery } from "@/lib/queryRewrite";

export async function rewriteForRetrieval(question: string) {
  return rewriteQuery(question);
}
