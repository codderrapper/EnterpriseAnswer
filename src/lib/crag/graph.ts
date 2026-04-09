// src/lib/crag/graph.ts
// LangGraph StateGraph: declares the CRAG workflow as a directed graph with cycle.
//
// Key design points:
// 1. Annotation.Root declares state shape with per-field reducers (type-safe, like TypedDict in Python)
// 2. addConditionalEdges reads state.decision.route written by gradeDocumentsNode — routing logic
//    stays in the node, not scattered across edge conditions
// 3. rewriteQuery → retrieve edge forms a cycle: LangGraph's core capability over plain DAG frameworks
// 4. Node functions receive (state, config) — config.configurable.send is the event channel

import { Annotation, StateGraph, START, END } from "@langchain/langgraph";
import type { Chunk, GradedChunk, Decision, CragState } from "./types";
import {
  retrieveNode,
  gradeDocumentsNode,
  rewriteQueryNode,
  generateNode,
  fallbackNode,
} from "./nodes";

// Annotation.Root defines state structure and merge strategy per field.
// Default reducer replaces the field value; custom reducers accumulate.
const CragStateAnnotation = Annotation.Root({
  workspaceId:      Annotation<string>(),
  originalQuestion: Annotation<string>(),
  activeQuery:      Annotation<string>(),
  // append-mode: nodes return only new items, reducer accumulates history
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

// Routing function reads the decision written by gradeDocumentsNode.
// Returns the name of the next node — LangGraph maps this via the routes object below.
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
  // Cycle: rewriteQuery feeds back into retrieve.
  // This is the structural reason LangGraph is used here — plain DAG frameworks
  // cannot express a node that can be visited more than once per run.
  .addEdge("rewriteQuery", "retrieve")
  .addEdge("generate", END)
  .addEdge("fallback", END);

export const cragGraph = workflow.compile();

// Factory for the initial state passed to graph.invoke().
// Centralises defaults so callers don't need to know internal field names.
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
