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

type NodeFn = (
  state: typeof WorkflowStateAnnotation.State,
) => Promise<Partial<typeof WorkflowStateAnnotation.State>>;

// Routing after routeTask
function routeAfterTask(
  state: typeof WorkflowStateAnnotation.State,
): "retrieveEvidence" | "rewriteQuery" | "fallback" {
  if (state.route === "fast_qa") return "retrieveEvidence";
  if (state.route === "workflow_qa") return "rewriteQuery";
  return "retrieveEvidence"; // default
}

const workflow = new StateGraph(WorkflowStateAnnotation)
  .addNode("initRun",          initRun          as NodeFn)
  .addNode("quickRetrieve",    quickRetrieve    as NodeFn)
  .addNode("routeTask",        routeTask        as NodeFn)
  .addNode("rewriteQuery",     rewriteQuery     as NodeFn)
  .addNode("retrieveEvidence", retrieveEvidence as NodeFn)
  .addNode("rerankEvidence",   rerankEvidence   as NodeFn)
  .addNode("gradeEvidence",    gradeEvidence    as NodeFn)
  .addNode("generateAnswer",   generateAnswer   as NodeFn)
  .addNode("verifyGrounding",  verifyGrounding  as NodeFn)
  .addNode("fallback",         fallback         as NodeFn)
  .addNode("finalizeRun",      finalizeRun      as NodeFn)
  .addEdge(START, "initRun")
  .addEdge("initRun", "quickRetrieve")
  .addEdge("quickRetrieve", "routeTask")
  .addConditionalEdges("routeTask", routeAfterTask, {
    retrieveEvidence: "retrieveEvidence",
    rewriteQuery: "rewriteQuery",
    fallback: "fallback",
  })
  .addEdge("rewriteQuery", "retrieveEvidence")
  .addEdge("retrieveEvidence", "rerankEvidence")
  .addConditionalEdges("rerankEvidence", (state) => {
    return state.route === "workflow_qa" ? "gradeEvidence" : "generateAnswer";
  }, {
    gradeEvidence:  "gradeEvidence",
    generateAnswer: "generateAnswer",
  })
  .addEdge("gradeEvidence", "generateAnswer")
  .addEdge("generateAnswer", "verifyGrounding")
  .addConditionalEdges("verifyGrounding", (state) =>
    state.route === "fallback" ? "fallback" : "finalizeRun",
    {
      fallback: "fallback",
      finalizeRun: "finalizeRun",
    }
  )
  .addEdge("fallback", "finalizeRun")
  .addEdge("finalizeRun", END);

export const knowledgeWorkflowGraph = workflow.compile();

export function createKnowledgeWorkflowGraph() {
  return knowledgeWorkflowGraph;
}
