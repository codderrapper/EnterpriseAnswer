// Legacy CRAG graph — re-exported from here so that src/lib/crag/graph.ts
// can be a pure shim. Do not add new workflow logic here; use graph.ts.

import { Annotation, StateGraph, START, END } from "@langchain/langgraph";
import type { Chunk, GradedChunk, Decision, CragState } from "./legacy-crag-types";
import {
  retrieveNode,
  gradeDocumentsNode,
  rewriteQueryNode,
  generateNode,
  fallbackNode,
} from "./legacy-crag-nodes";

const CragStateAnnotation = Annotation.Root({
  workspaceId:      Annotation<string>(),
  originalQuestion: Annotation<string>(),
  activeQuery:      Annotation<string>(),
  queryHistory: Annotation<string[]>({
    reducer: (existing: string[], update: string[]) => [...existing, ...update],
    default: () => [],
  }),
  retryCount:    Annotation<number>(),
  topK:          Annotation<number>(),
  threshold:     Annotation<number>(),
  retrievedDocs: Annotation<Chunk[]>(),
  gradedDocs:    Annotation<GradedChunk[]>(),
  selectedDocs:  Annotation<GradedChunk[]>(),
  decision:      Annotation<Decision | undefined>(),
  answer:        Annotation<string>(),
  fallbackMessage: Annotation<string | undefined>(),
});

function routeAfterGrading(
  state: typeof CragStateAnnotation.State,
): "generate" | "rewriteQuery" | "fallback" {
  const route = state.decision?.route;
  if (route === "generate") return "generate";
  if (route === "rewrite")  return "rewriteQuery";
  return "fallback";
}

const workflow = new StateGraph(CragStateAnnotation)
  .addNode("retrieve",       retrieveNode       as never)
  .addNode("gradeDocuments", gradeDocumentsNode as never)
  .addNode("rewriteQuery",   rewriteQueryNode   as never)
  .addNode("generate",       generateNode       as never)
  .addNode("fallback",       fallbackNode       as never)
  .addEdge(START, "retrieve")
  .addEdge("retrieve", "gradeDocuments")
  .addConditionalEdges("gradeDocuments", routeAfterGrading, {
    generate:     "generate",
    rewriteQuery: "rewriteQuery",
    fallback:     "fallback",
  })
  .addEdge("rewriteQuery", "retrieve")
  .addEdge("generate", END)
  .addEdge("fallback", END);

export const cragGraph = workflow.compile();

export function makeCragInitialState(
  question: string,
  topK: number,
  threshold: number,
  workspaceId: string,
): CragState {
  return {
    workspaceId,
    originalQuestion: question,
    activeQuery:      question,
    queryHistory:     [],
    retryCount:       0,
    topK,
    threshold,
    retrievedDocs:    [],
    gradedDocs:       [],
    selectedDocs:     [],
    decision:         undefined,
    answer:           "",
    fallbackMessage:  undefined,
  };
}
