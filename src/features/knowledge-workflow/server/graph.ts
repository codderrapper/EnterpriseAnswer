import { Annotation, StateGraph, START, END } from "@langchain/langgraph";
import type { WorkflowRoute, EvidenceDoc } from "./types";
import { initRun } from "./nodes/initRun";
import { quickRetrieve } from "./nodes/quickRetrieve";
import { routeTask } from "./nodes/routeTask";
import { rewriteQuery } from "./nodes/rewriteQuery";
import { retrieveEvidence } from "./nodes/retrieveEvidence";
import { rerankEvidence } from "./nodes/rerankEvidence";
import { gradeEvidence } from "./nodes/gradeEvidence";
import { generateAnswer } from "./nodes/generateAnswer";
import { verifyGrounding } from "./nodes/verifyGrounding";
import { fallback } from "./nodes/fallback";
import { finalizeRun } from "./nodes/finalizeRun";

const WorkflowStateAnnotation = Annotation.Root({
  userQuestion:       Annotation<string>(),
  normalizedQuestion: Annotation<string>(),
  workspaceId:        Annotation<string>(),
  route:              Annotation<WorkflowRoute | undefined>(),
  rewriteCount:       Annotation<number>(),
  retrievedDocs:      Annotation<EvidenceDoc[]>(),
  rerankedDocs:       Annotation<EvidenceDoc[]>(),
  selectedEvidence:   Annotation<EvidenceDoc[]>(),
  answerDraft:        Annotation<string>(),
  finalAnswer:        Annotation<string>(),
});

// Routing after routeTask
function routeAfterTask(state: typeof WorkflowStateAnnotation.State): "retrieveEvidence" | "fallback" {
  if (state.route === "fallback") return "fallback";
  return "retrieveEvidence";
}

const workflow = new StateGraph(WorkflowStateAnnotation)
  .addNode("initRun",          initRun          as never)
  .addNode("quickRetrieve",    quickRetrieve    as never)
  .addNode("routeTask",        routeTask        as never)
  .addNode("rewriteQuery",     rewriteQuery     as never)
  .addNode("retrieveEvidence", retrieveEvidence as never)
  .addNode("rerankEvidence",   rerankEvidence   as never)
  .addNode("gradeEvidence",    gradeEvidence    as never)
  .addNode("generateAnswer",   generateAnswer   as never)
  .addNode("verifyGrounding",  verifyGrounding  as never)
  .addNode("fallback",         fallback         as never)
  .addNode("finalizeRun",      finalizeRun      as never)
  .addEdge(START, "initRun")
  .addEdge("initRun", "quickRetrieve")
  .addEdge("quickRetrieve", "routeTask")
  .addConditionalEdges("routeTask", routeAfterTask, {
    retrieveEvidence: "retrieveEvidence",
    fallback: "fallback",
  })
  .addEdge("retrieveEvidence", "rerankEvidence")
  .addConditionalEdges("rerankEvidence", (state) => {
    return state.route === "workflow_qa" ? "gradeEvidence" : "generateAnswer";
  }, {
    gradeEvidence:  "gradeEvidence",
    generateAnswer: "generateAnswer",
  })
  .addEdge("gradeEvidence", "generateAnswer")
  .addEdge("generateAnswer", "verifyGrounding")
  .addEdge("verifyGrounding", "finalizeRun")
  .addEdge("fallback", "finalizeRun")
  .addEdge("finalizeRun", END);

export const knowledgeWorkflowGraph = workflow.compile();

export function createKnowledgeWorkflowGraph() {
  return knowledgeWorkflowGraph;
}
