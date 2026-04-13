// src/store/__tests__/workflowStore.test.ts
import { describe, expect, it, beforeEach } from "vitest";
import { useWorkflowRuntimeStore } from "@/features/knowledge-workflow/store/workflowRuntimeStore";

describe("workflowRuntimeStore", () => {
  beforeEach(() => {
    useWorkflowRuntimeStore.getState().reset();
  });

  it("applies route event: sets route field", () => {
    useWorkflowRuntimeStore.getState().applyRouteEvent("fast_qa", "direct_question");
    expect(useWorkflowRuntimeStore.getState().route).toBe("fast_qa");
  });

  it("applies evidence event: populates retrievedDocs", () => {
    const docs = [{ id: "1", snippet: "test content", similarity: 0.9 }];
    useWorkflowRuntimeStore.getState().applyEvidenceEvent("retrieved", docs);
    expect(useWorkflowRuntimeStore.getState().retrievedDocs).toHaveLength(1);
    expect(useWorkflowRuntimeStore.getState().retrievedDocs[0].id).toBe("1");
  });

  it("reset clears all state", () => {
    useWorkflowRuntimeStore.getState().applyRouteEvent("workflow_qa", "test");
    useWorkflowRuntimeStore.getState().reset();
    expect(useWorkflowRuntimeStore.getState().route).toBeNull();
    expect(useWorkflowRuntimeStore.getState().events).toHaveLength(0);
  });
});
