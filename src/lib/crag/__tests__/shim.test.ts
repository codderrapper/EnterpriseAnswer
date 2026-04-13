import { describe, expect, it } from "vitest";

describe("lib/crag shim", () => {
  it("re-exports types from features module", async () => {
    // Dynamic import ensures module resolution is tested at runtime
    const types = await import("../types");
    // These named exports must exist (they're type-only, but the module must resolve)
    // We verify by checking the module resolves without error — type exports
    // have no runtime value, so we just confirm the import itself succeeds.
    expect(types).toBeDefined();
  });

  it("re-exports graph exports from features module", async () => {
    // We don't invoke cragGraph (it needs LangGraph wiring), but we verify
    // the shim resolves and re-exports the expected names.
    const graphModule = await import("../graph");
    expect(typeof graphModule.cragGraph).toBe("object");
    expect(typeof graphModule.makeCragInitialState).toBe("function");
  });

  it("makeCragInitialState returns correct initial shape via shim", async () => {
    const { makeCragInitialState } = await import("../graph");
    const state = makeCragInitialState("test question", 5, 0.5, "ws-1");
    expect(state.originalQuestion).toBe("test question");
    expect(state.workspaceId).toBe("ws-1");
    expect(state.queryHistory).toEqual([]);
    expect(state.retryCount).toBe(0);
  });

  it("re-exports node functions from features module", async () => {
    const nodes = await import("../nodes");
    expect(typeof nodes.retrieveNode).toBe("function");
    expect(typeof nodes.gradeDocumentsNode).toBe("function");
    expect(typeof nodes.rewriteQueryNode).toBe("function");
    expect(typeof nodes.generateNode).toBe("function");
    expect(typeof nodes.fallbackNode).toBe("function");
  });
});
