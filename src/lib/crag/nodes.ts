// @deprecated — src/lib/crag is no longer the canonical module.
// This file is a compatibility shim. Use src/features/knowledge-workflow/server/ directly.
export {
  retrieveNode,
  gradeDocumentsNode,
  rewriteQueryNode,
  generateNode,
  fallbackNode,
} from "@/features/knowledge-workflow/server/legacy-crag-nodes";
