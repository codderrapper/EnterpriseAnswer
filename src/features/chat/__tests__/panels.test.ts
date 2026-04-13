import { describe, expect, it, beforeEach } from "vitest";
import { useWorkflowRuntimeStore } from "@/features/knowledge-workflow/store/workflowRuntimeStore";

describe("Ask UI workflow store integration", () => {
  beforeEach(() => {
    useWorkflowRuntimeStore.getState().reset();
  });

  it("route and evidence state update together", () => {
    const store = useWorkflowRuntimeStore.getState();
    store.applyRouteEvent("fast_qa", "direct_question");
    store.applyEvidenceEvent("retrieved", [{ id: "1", content: "evidence" }]);

    // Read the latest state after actions mutate the store
    const state = useWorkflowRuntimeStore.getState();
    expect(state.route).toBe("fast_qa");
    expect(state.retrievedDocs).toHaveLength(1);
  });
});
