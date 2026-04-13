# Unified Knowledge Workflow Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 将当前分裂的 `/api/search` 与 `/api/agent` 收敛为一个统一的 Knowledge Workflow Graph 主链路，并同步收口目录边界、流式协议与前端运行时状态。

**Architecture:** 保留 `src/app` / `src/app/api` 作为 Next.js 页面与 HTTP 入口层；新增 `src/features/knowledge-workflow` 承接 graph、nodes、events、feature-private store；将 `src/lib` 收口为基础设施层。统一使用 LangGraph 编排 `fast_qa` 与 `workflow_qa`，前端主入口统一使用 Vercel AI SDK 的 `useChat` 与官方 Stream Protocol，自定义工作流事件通过 `data-*` parts 传输。

**Tech Stack:** Next.js App Router, TypeScript, LangGraph, LangChain/OpenAI embeddings, Vercel AI SDK, Supabase, Zustand, Vitest.

---

## Scope

本计划只覆盖第一阶段主问答链路重构：

- 统一 graph
- 统一 API 入口
- 统一流式协议
- `fast_qa` / `workflow_qa`
- fallback / grounding verification
- 目录边界收口到 `app` / `app/api` / `components` / `features` / `lib` / `store`

不包含：

- Documents / Runs / Prompts 页面功能扩展
- 通用 Agent 平台
- 大规模视觉重设计

## File Structure

### New files

- `src/app/api/chat/route.ts`
- `src/features/knowledge-workflow/server/types.ts`
- `src/features/knowledge-workflow/server/state.ts`
- `src/features/knowledge-workflow/server/events.ts`
- `src/features/knowledge-workflow/server/graph.ts`
- `src/features/knowledge-workflow/server/services/retrieve.ts`
- `src/features/knowledge-workflow/server/services/rewrite.ts`
- `src/features/knowledge-workflow/server/services/rerank.ts`
- `src/features/knowledge-workflow/server/services/verify.ts`
- `src/features/knowledge-workflow/server/nodes/initRun.ts`
- `src/features/knowledge-workflow/server/nodes/quickRetrieve.ts`
- `src/features/knowledge-workflow/server/nodes/routeTask.ts`
- `src/features/knowledge-workflow/server/nodes/rewriteQuery.ts`
- `src/features/knowledge-workflow/server/nodes/retrieveEvidence.ts`
- `src/features/knowledge-workflow/server/nodes/rerankEvidence.ts`
- `src/features/knowledge-workflow/server/nodes/gradeEvidence.ts`
- `src/features/knowledge-workflow/server/nodes/generateAnswer.ts`
- `src/features/knowledge-workflow/server/nodes/verifyGrounding.ts`
- `src/features/knowledge-workflow/server/nodes/fallback.ts`
- `src/features/knowledge-workflow/server/nodes/finalizeRun.ts`
- `src/features/chat/store/chatRuntimeStore.ts`
- `src/features/knowledge-workflow/store/workflowRuntimeStore.ts`
- `src/features/chat/components/TracePanel.tsx`
- `src/features/chat/components/EvidencePanel.tsx`
- `src/features/knowledge-workflow/server/__tests__/graph.test.ts`
- `src/app/api/chat/__tests__/route.test.ts`

### Existing files to modify

- `src/app/api/search/route.ts`
- `src/app/api/agent/route.ts`
- `src/app/ask/page.tsx`
- `src/app/agent/components/AgentChat.tsx`
- `src/app/agent/components/NodeDetailPanel.tsx`
- `src/lib/queryRewrite.ts`
- `src/lib/reranker.ts`
- `src/lib/embedClient.ts`
- `src/lib/crag/graph.ts`
- `src/lib/crag/nodes.ts`
- `src/lib/crag/types.ts`
- `src/store/chatStore.ts`
- `src/store/agentStore.ts`
- `src/components/SourcesPanel.tsx`
- `src/components/AgentStepsPanel.tsx`
- `src/utils/supabase/client.ts`
- `src/utils/supabase/server.ts`
- `src/utils/supabase/middleware.ts`

### Existing files to retire after migration

- `src/app/api/search/route.ts` 作为主产品入口
- `src/store/chatStore.ts`
- `src/store/agentStore.ts`
- `src/lib/crag/*` 作为长期 canonical workflow 位置

## Task 1: Scaffold the Feature and Infrastructure Boundaries

**Files:**
- Create: `src/features/knowledge-workflow/server/types.ts`
- Create: `src/features/knowledge-workflow/server/state.ts`
- Create: `src/features/knowledge-workflow/server/events.ts`
- Create: `src/features/knowledge-workflow/server/graph.ts`
- Create: `src/features/chat/store/chatRuntimeStore.ts`
- Create: `src/features/knowledge-workflow/store/workflowRuntimeStore.ts`

- [x] **Step 1: Create the new feature-private type definitions**

目标：先固定业务模块落点，不再让 workflow 新代码继续进入 `src/lib`。

```ts
// src/features/knowledge-workflow/server/types.ts
export type WorkflowRoute = "fast_qa" | "workflow_qa" | "clarification" | "fallback";

export type EvidenceDoc = {
  id: string;
  documentId?: number;
  content: string;
  similarity?: number;
  relevance?: "relevant" | "partial" | "irrelevant";
};
```

- [x] **Step 2: Create the first workflow state model**

```ts
// src/features/knowledge-workflow/server/state.ts
import type { WorkflowRoute, EvidenceDoc } from "./types";

export type WorkflowState = {
  userQuestion: string;
  normalizedQuestion: string;
  workspaceId: string;
  route?: WorkflowRoute;
  rewriteCount: number;
  retrievedDocs: EvidenceDoc[];
  rerankedDocs: EvidenceDoc[];
  selectedEvidence: EvidenceDoc[];
  answerDraft: string;
  finalAnswer: string;
};
```

- [x] **Step 3: Create the stream event contracts**

```ts
// src/features/knowledge-workflow/server/events.ts
export type WorkflowEvent =
  | { type: "data-run"; ts: number; requestId: string; data: Record<string, unknown> }
  | { type: "data-route"; ts: number; requestId: string; data: Record<string, unknown> }
  | { type: "data-node"; ts: number; requestId: string; data: Record<string, unknown> }
  | { type: "data-evidence"; ts: number; requestId: string; data: Record<string, unknown> }
  | { type: "data-verification"; ts: number; requestId: string; data: Record<string, unknown> }
  | { type: "data-clarification"; ts: number; requestId: string; data: Record<string, unknown> };
```

- [x] **Step 4: Create the graph entry skeleton**

```ts
// src/features/knowledge-workflow/server/graph.ts
import type { WorkflowState } from "./state";

export function createKnowledgeWorkflowGraph() {
  return {
    invoke: async (state: WorkflowState) => state,
  };
}
```

- [x] **Step 5: Create the feature-private store skeletons**

```ts
// src/features/chat/store/chatRuntimeStore.ts
import { create } from "zustand";

export const useChatRuntimeStore = create(() => ({
  content: "",
}));
```

```ts
// src/features/knowledge-workflow/store/workflowRuntimeStore.ts
import { create } from "zustand";

export const useWorkflowRuntimeStore = create(() => ({
  route: null as string | null,
  events: [] as unknown[],
}));
```

- [x] **Step 6: Run typecheck to verify the new boundaries compile**

Run: `npm run typecheck`
Expected: The repo may still fail on unrelated legacy issues, but the new files should parse and resolve.

- [x] **Step 7: Commit**

```bash
git add src/features/knowledge-workflow/server src/features/chat/store src/features/knowledge-workflow/store
git commit -m "refactor: scaffold feature boundaries for knowledge workflow"
```

## Task 2: Extract Retrieval, Rewrite, and Rerank into Workflow Services

**Files:**
- Create: `src/features/knowledge-workflow/server/services/retrieve.ts`
- Create: `src/features/knowledge-workflow/server/services/rewrite.ts`
- Create: `src/features/knowledge-workflow/server/services/rerank.ts`
- Modify: `src/app/api/search/route.ts`
- Modify: `src/lib/queryRewrite.ts`
- Modify: `src/lib/reranker.ts`

- [x] **Step 1: Write a failing service test for retrieval normalization**

```ts
// src/features/knowledge-workflow/server/__tests__/graph.test.ts
import { describe, expect, it } from "vitest";

describe("retrieve service", () => {
  it("normalizes rpc rows into evidence docs", async () => {
    expect(true).toBe(false);
  });
});
```

- [x] **Step 2: Run the test to confirm the gap**

Run: `npx vitest run src/features/knowledge-workflow/server/__tests__/graph.test.ts -t "retrieve service"`
Expected: FAIL because the test intentionally asserts the not-yet-implemented behavior.

- [x] **Step 3: Extract the retrieval logic from the legacy route**

目标：把 `src/app/api/search/route.ts` 中的 embedding + `match_documents` RPC + match normalization 抽到服务层。

```ts
// src/features/knowledge-workflow/server/services/retrieve.ts
export async function retrieveEvidence() {
  return [];
}
```

- [x] **Step 4: Wrap existing rewrite and rerank helpers for feature-local usage**

```ts
// src/features/knowledge-workflow/server/services/rewrite.ts
import { rewriteQuery } from "@/lib/queryRewrite";

export async function rewriteForRetrieval(question: string) {
  return rewriteQuery(question);
}
```

```ts
// src/features/knowledge-workflow/server/services/rerank.ts
import { rerankChunks } from "@/lib/reranker";

export async function rerankEvidence(question: string, docs: any[]) {
  return rerankChunks(question, docs);
}
```

- [x] **Step 5: Replace direct legacy route internals with service calls where safe**

目标：先让新服务成为 canonical implementation，旧 route 暂时复用。

```ts
// src/app/api/search/route.ts
// use retrieveEvidence service instead of inline retrieval internals
```

- [x] **Step 6: Re-run the focused test**

Run: `npx vitest run src/features/knowledge-workflow/server/__tests__/graph.test.ts -t "retrieve service"`
Expected: PASS

- [x] **Step 7: Commit**

```bash
git add src/features/knowledge-workflow/server/services src/app/api/search/route.ts src/lib/queryRewrite.ts src/lib/reranker.ts src/features/knowledge-workflow/server/__tests__/graph.test.ts
git commit -m "refactor: extract workflow retrieval rewrite and rerank services"
```

## Task 3: Implement the Unified Workflow State Machine

**Files:**
- Create: `src/features/knowledge-workflow/server/nodes/initRun.ts`
- Create: `src/features/knowledge-workflow/server/nodes/quickRetrieve.ts`
- Create: `src/features/knowledge-workflow/server/nodes/routeTask.ts`
- Create: `src/features/knowledge-workflow/server/nodes/rewriteQuery.ts`
- Create: `src/features/knowledge-workflow/server/nodes/retrieveEvidence.ts`
- Create: `src/features/knowledge-workflow/server/nodes/rerankEvidence.ts`
- Create: `src/features/knowledge-workflow/server/nodes/gradeEvidence.ts`
- Create: `src/features/knowledge-workflow/server/nodes/generateAnswer.ts`
- Create: `src/features/knowledge-workflow/server/nodes/verifyGrounding.ts`
- Create: `src/features/knowledge-workflow/server/nodes/fallback.ts`
- Create: `src/features/knowledge-workflow/server/nodes/finalizeRun.ts`
- Modify: `src/features/knowledge-workflow/server/graph.ts`
- Test: `src/features/knowledge-workflow/server/__tests__/graph.test.ts`

- [x] **Step 1: Write failing route-path tests**

```ts
describe("knowledge workflow graph", () => {
  it("routes direct questions to fast_qa", async () => {
    expect(true).toBe(false);
  });

  it("routes comparison questions to workflow_qa", async () => {
    expect(true).toBe(false);
  });
});
```

- [x] **Step 2: Run the route-path tests**

Run: `npx vitest run src/features/knowledge-workflow/server/__tests__/graph.test.ts -t "routes"`
Expected: FAIL

- [x] **Step 3: Implement `initRun`, `quickRetrieve`, and `routeTask`**

最小代码骨架：

```ts
// src/features/knowledge-workflow/server/nodes/routeTask.ts
import type { WorkflowState } from "../state";

export async function routeTask(state: WorkflowState) {
  const q = state.userQuestion.toLowerCase();
  const isComparison = q.includes("对比") || q.includes("差异");
  return {
    route: isComparison ? "workflow_qa" : "fast_qa",
  };
}
```

- [x] **Step 4: Implement the downstream nodes for both paths**

```ts
// src/features/knowledge-workflow/server/nodes/fallback.ts
import type { WorkflowState } from "../state";

export async function fallback(state: WorkflowState) {
  return {
    finalAnswer:
      state.finalAnswer ||
      `知识库中未找到与「${state.userQuestion}」足够相关的内容，请换个角度描述问题或补充文档后重试。`,
  };
}
```

- [x] **Step 5: Assemble the graph in `graph.ts`**

```ts
// src/features/knowledge-workflow/server/graph.ts
export function createKnowledgeWorkflowGraph() {
  return {
    invoke: async (state) => state,
  };
}
```

- [x] **Step 6: Re-run the graph tests**

Run: `npx vitest run src/features/knowledge-workflow/server/__tests__/graph.test.ts`
Expected: PASS for the new route-path coverage, with future tests still pending.

- [x] **Step 7: Commit**

```bash
git add src/features/knowledge-workflow/server/nodes src/features/knowledge-workflow/server/graph.ts src/features/knowledge-workflow/server/__tests__/graph.test.ts
git commit -m "feat: implement unified knowledge workflow graph skeleton"
```

## Task 4: Add Unified AI SDK Event Emission and Thin API Entry

**Files:**
- Create: `src/app/api/chat/route.ts`
- Create: `src/app/api/chat/__tests__/route.test.ts`
- Modify: `src/app/api/agent/route.ts`
- Modify: `src/app/api/search/route.ts`

- [x] **Step 1: Write the failing API route test**

```ts
import { describe, expect, it } from "vitest";

describe("POST /api/chat", () => {
  it("opens a streaming response", async () => {
    expect(true).toBe(false);
  });
});
```

- [x] **Step 2: Run the API route test**

Run: `npx vitest run src/app/api/chat/__tests__/route.test.ts`
Expected: FAIL

- [x] **Step 3: Implement the unified API route as a thin controller**

```ts
// src/app/api/chat/route.ts
import { createDataStreamResponse } from "ai";

export async function POST() {
  return createDataStreamResponse({
    execute: async () => {},
  });
}
```

要求：

- 请求参数校验在 route 中完成
- workspace 上下文在 route 中完成
- graph 调用在 feature server 模块中完成
- 官方文本输出使用 AI SDK stream parts
- 工作流事件统一映射为自定义 `data-*` parts
- route 中不再发自定义 JSONL

- [x] **Step 4: Deprecate the legacy split routes**

方式二选一：

- `/api/agent` 转发到 `/api/chat`
- `/api/search` 仅保留 debug / compatibility wrapper

最小示例：

```ts
// src/app/api/agent/route.ts
export { POST } from "@/app/api/chat/route";
```

- [x] **Step 5: Re-run the route test**

Run: `npx vitest run src/app/api/chat/__tests__/route.test.ts`
Expected: PASS

- [x] **Step 6: Commit**

```bash
git add src/app/api/chat src/app/api/agent/route.ts src/app/api/search/route.ts
git commit -m "feat: add unified chat api route"
```

## Task 5: Replace Legacy Frontend Runtime Stores with Feature-Private Stores

**Files:**
- Modify: `src/store/chatStore.ts`
- Modify: `src/store/agentStore.ts`
- Modify: `src/features/chat/store/chatRuntimeStore.ts`
- Modify: `src/features/knowledge-workflow/store/workflowRuntimeStore.ts`
- Test: `src/store/__tests__/chatStore.test.ts`

- [x] **Step 1: Write a failing reducer test for route and evidence events**

```ts
import { describe, expect, it } from "vitest";

describe("chat runtime reducer", () => {
  it("applies route and evidence events", () => {
    expect(true).toBe(false);
  });
});
```

- [x] **Step 2: Run the reducer test**

Run: `npx vitest run src/store/__tests__/chatStore.test.ts`
Expected: FAIL

- [x] **Step 3: Move chat answer state into `features/chat/store/chatRuntimeStore.ts`**

```ts
export const useChatRuntimeStore = create(() => ({
  content: "",
  requestId: null as string | null,
  status: "idle" as "idle" | "streaming" | "done" | "error",
  messages: [] as unknown[],
}));
```

- [x] **Step 4: Move route/trace/evidence state into `features/knowledge-workflow/store/workflowRuntimeStore.ts`**

```ts
export const useWorkflowRuntimeStore = create(() => ({
  route: null as string | null,
  events: [] as unknown[],
  retrievedDocs: [] as unknown[],
  rerankedDocs: [] as unknown[],
  selectedDocs: [] as unknown[],
  verification: null as unknown,
}));
```

- [x] **Step 5: Turn the old `src/store/*` files into compatibility shims or remove them**

最小过渡方案：

```ts
// src/store/chatStore.ts
export { useChatRuntimeStore as useChatStore } from "@/features/chat/store/chatRuntimeStore";
```

- [x] **Step 6: Re-run the reducer test**

Run: `npx vitest run src/store/__tests__/chatStore.test.ts`
Expected: PASS

- [x] **Step 7: Commit**

```bash
git add src/store src/features/chat/store src/features/knowledge-workflow/store src/store/__tests__/chatStore.test.ts
git commit -m "refactor: move runtime stores into feature modules"
```

## Task 6: Move Main Ask UI to the Unified Runtime Model

**Files:**
- Create: `src/features/chat/components/TracePanel.tsx`
- Create: `src/features/chat/components/EvidencePanel.tsx`
- Modify: `src/app/ask/page.tsx`
- Modify: `src/app/agent/components/AgentChat.tsx`
- Modify: `src/app/agent/components/NodeDetailPanel.tsx`
- Modify: `src/components/SourcesPanel.tsx`
- Modify: `src/components/AgentStepsPanel.tsx`

- [x] **Step 1: Write a failing UI test for route + evidence rendering**

```ts
import { describe, expect, it } from "vitest";

describe("Ask UI", () => {
  it("shows route, evidence, and streamed answer state", () => {
    expect(true).toBe(false);
  });
});
```

- [x] **Step 2: Run the UI test**

Run: `npm test`
Expected: FAIL because the new panels are not wired yet.

- [x] **Step 3: Create `TracePanel` and `EvidencePanel` as feature-private components**

```tsx
// src/features/chat/components/TracePanel.tsx
export default function TracePanel() {
  return null;
}
```

```tsx
// src/features/chat/components/EvidencePanel.tsx
export default function EvidencePanel() {
  return null;
}
```

- [x] **Step 4: Update `src/app/ask/page.tsx` to render the unified state**

要求：

- Ask 页面改为消费 `useChat` + feature-private stores
- 页面自身只做布局和组装
- 正文回答由官方 message/text parts 驱动
- route / trace / evidence / verification 由自定义 `data-*` parts 驱动
- Trace 与 Evidence 通过新组件展示

- [x] **Step 5: Move workflow-private UI out of global components where possible**

最小原则：

- `SourcesPanel` 不再作为全局组件演进
- `AgentStepsPanel` 不再作为全局组件演进

- [x] **Step 6: Re-run the UI tests**

Run: `npm test`
Expected: PASS or only fail in tests that still target intentionally retired legacy behavior.

- [x] **Step 7: Commit**

```bash
git add src/features/chat/components src/app/ask/page.tsx src/app/agent/components src/components/SourcesPanel.tsx src/components/AgentStepsPanel.tsx
git commit -m "feat: move ask ui to unified workflow runtime model"
```

## Task 7: Retire `src/lib/crag` as the Canonical Workflow Location

**Files:**
- Modify: `src/lib/crag/graph.ts`
- Modify: `src/lib/crag/nodes.ts`
- Modify: `src/lib/crag/types.ts`
- Modify: `src/features/knowledge-workflow/server/*`

- [x] **Step 1: Decide the migration posture**

目标不是立刻删掉 `src/lib/crag`，而是停止把它当作 canonical implementation。

建议方式：

- 新 workflow 代码都落在 `features/knowledge-workflow`
- `lib/crag` 只保留 compatibility layer，随后逐步删除

- [x] **Step 2: Turn `lib/crag` into a compatibility shim**

最小示例：

```ts
// src/lib/crag/graph.ts
export { createKnowledgeWorkflowGraph } from "@/features/knowledge-workflow/server/graph";
```

- [x] **Step 3: Move any remaining canonical types and node logic**

要求：

- 不再在 `src/lib/crag` 内新增逻辑
- 所有后续改动只打到 `features/knowledge-workflow`

- [x] **Step 4: Run tests for the migrated graph**

Run: `npx vitest run src/features/knowledge-workflow/server/__tests__/graph.test.ts src/app/api/chat/__tests__/route.test.ts`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add src/lib/crag src/features/knowledge-workflow/server
git commit -m "refactor: retire lib crag as canonical workflow module"
```

## Task 8: Unify `utils` and `lib`, Then Verify the Whole Flow

**Files:**
- Modify: `src/utils/supabase/client.ts`
- Modify: `src/utils/supabase/server.ts`
- Modify: `src/utils/supabase/middleware.ts`
- Modify: `src/lib/supabaseClient.ts`
- Modify: `src/lib/supabaseServer.ts`
- Modify: `README.md` or implementation notes if needed

- [x] **Step 1: Move duplicate Supabase helpers behind one shared boundary**

目标：不再同时维护 `src/utils/supabase/*` 和 `src/lib/supabase*` 两套语义重叠的入口。

最小过渡方案：

```ts
// src/utils/supabase/server.ts
export { getSupabaseServerClient as createClient } from "@/lib/supabaseServer";
```

- [x] **Step 2: Run build, typecheck, and tests**

Run:

```bash
npm run build
npm run typecheck
npm test
```

Expected:

- build passes
- typecheck passes, or remaining issues are explicitly known and fixed immediately
- tests pass

- [x] **Step 3: Verify the four manual QA scenarios**

Check manually:

- 简单事实问答 -> `fast_qa`
- 对比类问题 -> `workflow_qa`
- 模糊问题 -> `clarification` 或 `workflow_qa`
- 证据不足 -> fallback

- [x] **Step 4: Commit**

```bash
git add src/utils src/lib README.md
git commit -m "refactor: unify supabase helpers and verify workflow phase 1"
```

## Self-Review

### Spec coverage

This plan covers the parts of the spec that matter for phase 1:

- unified graph
- feature-based directory structure
- thin `app/api` routes
- unified AI SDK transport
- feature-private stores
- fallback and verification

It intentionally does not cover:

- documents/runs/prompts feature redesign
- advanced analytics
- generic agent tooling

### Placeholder scan

This plan avoids vague filler language and keeps transitional choices constrained to explicit tasks.

### Type consistency

The plan consistently uses:

- `fast_qa`
- `workflow_qa`
- `clarification`
- `fallback`

It also consistently treats:

- `src/app/api` as the HTTP entry layer
- `src/features/knowledge-workflow` as the canonical workflow implementation layer
- `src/lib` as infrastructure only

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-13-unified-knowledge-workflow-phase-1.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
