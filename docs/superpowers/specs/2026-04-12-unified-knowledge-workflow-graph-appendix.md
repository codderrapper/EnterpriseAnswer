# 统一 Graph 企业知识工作流助手附录

日期：2026-04-12

本文档是主设计文档《统一 Graph 企业知识工作流助手设计文档》的实施附录，重点补充：

- 路由判定细则
- 流式事件协议
- 前端状态模型
- 失败场景
- 验证清单
- 与现有代码的映射关系

## 1. 路由判定附录

### 1.1 第一阶段推荐路由逻辑

第一阶段建议采用“规则初筛 + quick retrieve + 证据评估”的混合路由。

原因：

- 比纯规则更稳
- 比纯 LLM 路由更可控
- 对面试官更容易解释

### 1.2 推荐判定输入

路由节点可以使用以下输入：

- `userQuestion`
- `normalizedQuestion`
- `quickRetrieve.top1Score`
- `quickRetrieve.top3ScoreAvg`
- `quickRetrieve.hitCount`
- `quickRetrieve.hasConflictingEvidence`
- `quickRetrieve.isSparse`
- `intentSignals`

### 1.3 intentSignals 推荐字段

建议从问题文本中提取下列布尔信号：

- `asksComparison`
- `asksSummary`
- `asksChecklist`
- `asksRisk`
- `asksRecommendation`
- `hasAmbiguousSubject`
- `mentionsMultipleEntities`
- `requestsStructuredOutput`

### 1.4 quick retrieve 推荐派生信号

- `isHighConfidence`: top1 高、top3 分布稳定
- `isLowConfidence`: top1 低或命中极少
- `hasConflict`: 候选片段之间出现明显冲突
- `needsRewrite`: 问题模糊或低召回
- `enoughForDirectAnswer`: 基本能支撑一次直接回答

### 1.5 第一版推荐规则

走 `fast_qa`：

- `enoughForDirectAnswer = true`
- `requestsStructuredOutput = false`
- `asksComparison = false`
- `asksSummary = false`
- `asksRisk = false`
- `hasAmbiguousSubject = false`

走 `workflow_qa`：

- `asksComparison = true`
- 或 `asksSummary = true`
- 或 `requestsStructuredOutput = true`
- 或 `isLowConfidence = true`
- 或 `hasConflict = true`
- 或 `needsRewrite = true`

走 `clarification`：

- `hasAmbiguousSubject = true`
- 且 quick retrieve 无法建立有效 evidence base

走 `fallback`：

- 重试达到上限
- 或校验失败且无法恢复

### 1.6 路由节点输出建议

建议 route 节点输出：

- `route`
- `reason`
- `signals`
- `confidence`

示例：

```ts
{
  route: "workflow_qa",
  reason: "question_requires_comparison_and_initial_retrieval_is_low_confidence",
  confidence: 0.84,
  signals: {
    asksComparison: true,
    isLowConfidence: true,
    hitCount: 2,
    top1Score: 0.43,
  }
}
```

## 2. 流式事件协议附录

### 2.1 协议目标

前端所有页面和面板都只消费一套 AI SDK Stream Protocol。协议必须：

- 稳定
- 固定字段
- 可增量扩展
- 可同时支持文本流与结构化 trace

### 2.2 官方协议 part 与业务事件的区别

这里需要严格区分两层：

#### 第一层：官方 protocol parts

这部分由 AI SDK 定义，例如：

- 文本相关 parts
- source 相关 parts
- error
- step / finish 相关 parts

这类 type 不能由本项目随意重命名。

#### 第二层：业务自定义 data parts

这部分由本项目定义，用于承载知识工作流事件。

推荐不要直接把业务事件塞成“伪官方 type”，而是明确使用自定义 `data-*` parts。

### 2.3 自定义业务事件分类

推荐的业务事件语义如下：

- route
- node
- evidence
- verification
- clarification
- run

推荐的 `data-*` part 命名如下：

- `data-route`
- `data-node`
- `data-evidence`
- `data-verification`
- `data-clarification`
- `data-run`

如果后续想进一步收敛，也可以统一为：

- `data-workflow`

再在 payload 中使用 `kind` 区分具体事件。

### 2.4 自定义业务事件固定字段

所有结构化事件建议都带：

- `ts`
- `requestId`
- `runId` 可选

并根据业务类别附带 `data`。

### 2.5 业务事件定义建议

#### `data-run`

```ts
{
  type: "data-run",
  ts: number,
  requestId: string,
  data: {
    kind: "run_started" | "run_completed" | "run_failed",
    question?: string,
    workspaceId?: string,
    model?: string,
    runId?: number,
    route?: string,
    status?: "answered" | "clarification" | "fallback",
    durationMs?: number,
    message?: string,
  }
}
```

#### `data-route`

```ts
{
  type: "data-route",
  ts: number,
  requestId: string,
  data: {
    kind: "route_decided",
    route: "fast_qa" | "workflow_qa" | "clarification" | "fallback",
    reason: string,
    confidence?: number,
    signals?: Record<string, unknown>,
  }
}
```

#### `data-node`

```ts
{
  type: "data-node",
  ts: number,
  requestId: string,
  data: {
    kind: "node_started" | "node_completed" | "node_failed",
    node: string,
    label?: string,
    summary?: Record<string, unknown>,
    durationMs?: number,
    message?: string,
    recoverable?: boolean,
  }
}
```

#### `data-evidence`

```ts
{
  type: "data-evidence",
  ts: number,
  requestId: string,
  data: {
    kind: "evidence_updated",
    stage: "retrieved" | "reranked" | "selected",
    documents: Array<{
      id: string,
      documentId?: number,
      similarity?: number,
      relevance?: string,
      snippet: string,
    }>
  }
}
```

#### `data-verification`

```ts
{
  type: "data-verification",
  ts: number,
  requestId: string,
  data: {
    kind: "verification_completed",
    grounded: boolean,
    reason: string,
    unsupportedClaims?: number,
  }
}
```

#### `data-clarification`

```ts
{
  type: "data-clarification",
  ts: number,
  requestId: string,
  data: {
    kind: "clarification_requested",
    question: string,
    reason: string,
  }
}
```

### 2.6 协议约束

- 不允许同一语义出现多个字段命名，如 `message`、`error`、`data.message` 混用
- `run` 相关完成事件的 `runId` 必须稳定放在 `data.runId`
- 结构化事件必须是 append-only，方便前端 reducer
- 自定义业务事件必须明确通过 `data-*` parts 承载，而不是伪装成官方 protocol types
- 协议版本如需升级，应显式添加 `schemaVersion`

## 3. 前端状态模型附录

### 3.1 前端不应做什么

前端 store 不应继续通过“大量猜测逻辑”从不稳定 data 结构中反推状态。

不应继续依赖：

- 事件字段不一致时的兼容分支
- `lastRunningNode` 之类不稳定的错误归属逻辑
- 每次全量重建但事件缺乏固定语义的 reducer

### 3.2 推荐前端状态切分

建议前端 runtime store 至少拆为：

- `answerState`
- `traceState`
- `evidenceState`
- `runState`

### 3.3 `answerState`

- `content`
- `status`
- `clarificationQuestion`

### 3.4 `traceState`

- `route`
- `/nodes`
- `currentNode`
- `completedNodes`
- `failedNode`
- `events`

### 3.5 `evidenceState`

- `retrievedDocs`
- `rerankedDocs`
- `selectedDocs`
- `verificationResult`

### 3.6 `runState`

- `requestId`
- `runId`
- `status`
- `durationMs`
- `tokenUsage`

### 3.7 推荐 reducer 模型

建议前端基于 `useChat` 返回的官方 message parts 与自定义 `data-*` parts 更新状态。

推荐模型：

- 正文回答由官方 text parts 驱动
- route / trace / evidence / verification / clarification 由自定义 `data-*` parts 驱动

建议前端以事件驱动 reducer 方式更新：

- 收到 `data-route` 时写 route
- 收到 `data-node` 时更新当前节点、完成节点或失败节点
- 收到 `data-evidence` 时更新证据面板
- 收到 `data-verification` 时更新校验状态
- 收到 `data-run` 时更新 run 生命周期状态

## 4. 失败场景附录

### 4.1 检索无结果

系统行为：

- 标记 low confidence
- 如允许重写则先 rewrite
- 重试后仍不足则 fallback

### 4.2 证据冲突

系统行为：

- route 到 workflow
- 进行 evidence grading
- 视情况输出“现有文档存在冲突”而不是强行合并

### 4.3 生成结果不 grounded

系统行为：

- verification fail
- 触发 fallback 或要求澄清
- 明确告诉用户当前答案无法由文档支撑

### 4.4 路由误判

系统行为：

- 保留 route reason 便于后续调优
- 允许以 feature flag 或 debug 参数覆盖 route

### 4.5 节点执行异常

系统行为：

- 发送 `node_failed`
- 若可恢复则继续走 fallback
- 若不可恢复则发送 `run_failed`

## 5. 与现有代码映射附录

### 5.1 可直接抽出为 node 逻辑的现有能力

来自 `/api/search`：

- 参数标准化
- query rewrite
- embedding 与 retrieval
- rerank
- 生成回答
- token / cost / ttfb / duration 记录

来自 `src/lib/crag`：

- graph 编排基础
- retrieve / rewrite / generate / fallback 的节点思路

### 5.2 现有文件的建议去向

- `src/app/api/search/route.ts`
  - 保留为过渡期 HTTP 入口，内部逻辑逐步拆解到 `src/features/knowledge-workflow/server/*`
- `src/app/api/agent/route.ts`
  - 演进为统一入口 `api/chat/route.ts`，并保持 route 文件足够薄
- `src/lib/crag/*`
  - 迁移为 `src/features/knowledge-workflow/server/*`
- `src/store/chatStore.ts`
  - 迁移为 `src/features/chat/store/*`，并从手写流解析改为 AI SDK 事件消费
- `src/store/agentStore.ts`
  - 迁移为 `src/features/knowledge-workflow/store/*`，合并进统一 runtime store 或拆为 trace store
- `src/components/AgentStepsPanel.tsx`
  - 迁移为 feature-private 组件，而不是继续保留在全局 `components`
- `src/components/SourcesPanel.tsx`
  - 迁移为 `features/chat/components/*` 或等价目录
- `src/utils/supabase/*`
  - 并入 `src/lib/supabase/*`，不再维持 `utils` 与 `lib` 双轨

### 5.3 企业级目录边界补充

建议后续目录边界按以下原则收敛：

- `src/app`：页面入口层
- `src/app/api`：HTTP 入口层
- `src/components`：跨页面共享 UI
- `src/lib`：基础设施与通用能力
- `src/store`：真正全局的 client state
- `src/types`：跨域共享类型
- `src/features`：业务域实现

统一 graph 的核心代码应明确归属到：

- `src/features/knowledge-workflow/server/*`

而不是继续放在泛化的 `src/lib` 目录下。

### 5.4 建议保留但降级的旧页面

- `/debug/search`
- `/debug/workflow`

这些页面仍可存在，但应共享新协议和新 graph，而不是继续维持旧架构。

## 6. 验证清单附录

第一阶段开发完成后，至少验证以下项目：

### 6.1 架构一致性

- [ ] 主产品只通过一个后端入口发起问答
- [ ] 前端只保留一种流式消费协议
- [ ] `/api/search` 不再承担主产品职责

### 6.2 功能正确性

- [ ] 明确事实问答能走 `fast_qa`
- [ ] 对比/汇总类问题能走 `workflow_qa`
- [ ] 检索不足时会 rewrite 或 fallback
- [ ] 回答不 grounded 时不会直接输出最终答案

### 6.3 观测正确性

- [ ] 前端可看到 route
- [ ] 前端可看到节点执行顺序
- [ ] 前端可看到 selected evidence
- [ ] 前端可看到 verification 结果
- [ ] run history 能记录 route、status、sources 和关键指标

### 6.4 体验质量

- [ ] 简单问题响应速度可接受
- [ ] 复杂问题 trace 信息清晰
- [ ] fallback 文案专业且可理解
- [ ] clarification 文案清晰具体

## 7. 第一阶段建议样例问题

建议用以下问题做演示与验收：

### 7.1 简单问答

- “年假多少天？”
- “报销流程在哪里提交？”

预期：

- 进入 `fast_qa`
- 正常检索、回答、校验

### 7.2 复杂综合

- “对比入职流程和转正流程需要的材料差异”
- “把请假相关制度整理成一份 checklist”

预期：

- 进入 `workflow_qa`
- 多文档 evidence selection
- 结构化输出

### 7.3 模糊问题

- “这个流程有啥问题？”
- “合同这块怎么处理？”

预期：

- route 到 `clarification` 或 `workflow_qa`
- 不直接瞎答

### 7.4 证据不足

- “公司有无海外调岗补贴政策？”

预期：

- 若知识库无相关内容，进入 fallback
- 解释证据不足，而不是编造答案

## 8. 最终建议

对后续开发应坚持以下判断：

- 统一 graph 是为了统一架构，不是为了复杂化所有请求
- 复杂任务必须限定在企业知识工作流范围内
- 可信性与可观测性比“多几个 agent 节点”更重要
- 所有新能力都应优先落到统一 graph 和统一协议上

当你后续开发拿不准是否该加一个新节点或新路径时，可以先问两个问题：

1. 这个变化是否提升了企业知识场景中的可信性、可观测性或复杂任务完成质量？
2. 这个变化是否仍然服从统一 graph、统一协议、统一 run 观测的原则？

如果两个问题都答“是”，再继续做。
