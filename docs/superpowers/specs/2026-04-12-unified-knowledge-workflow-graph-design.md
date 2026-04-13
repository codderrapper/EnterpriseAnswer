# 统一 Graph 企业知识工作流助手设计文档

日期：2026-04-12

## 1. 文档目的

本文档定义本项目下一阶段的核心重构方向：将当前割裂的 `/api/search` 常规 RAG 链路与 `/api/agent` LangGraph 实验链路收敛为一个统一的企业知识工作流助手架构。

该设计的目标不是“为了用 LangGraph 而用 LangGraph”，也不是把项目包装成一个通用 Agent Playground，而是建立一套更像企业产品的统一编排层：

- 所有请求进入统一后端工作流
- 简单问题走高可靠、低延迟的快路径
- 复杂知识任务走多步工作流路径
- 前端只消费一套流式协议
- 系统可以解释为什么回答、为什么拒答、为什么重试、为什么进入复杂路径

本设计将作为后续重构和实现的单一事实来源。

## 2. 背景与当前问题

### 2.1 当前已有能力

当前项目已经具备以下对企业知识产品有价值的基础能力：

- 文档上传、分片、向量化与检索
- Ask 页面与基础知识问答体验
- `/api/search` 中的 rewrite、rerank、run history、策略参数等能力
- `/api/agent` 中基于 LangGraph 的 CRAG 原型
- 文档管理、运行历史、Prompt 策略页、调试页
- Supabase、RLS、多租户工作空间隔离

这些基础并不差，说明项目不需要整体推倒重来。

### 2.2 当前主要问题

当前项目最大的问题不是“有没有用上更高级的 AI 框架”，而是“系统心智模型不统一”。

具体表现为：

- `/api/search` 与 `/api/agent` 是两套后端主链路
- `/api/search` 采用自定义 JSONL 流协议，`/api/agent` 采用 AI SDK data stream
- 前端存在两套流式消费思路：手工 `reader.read()` 与 AI SDK hook
- 观测信息分散，简单问答和工作流 trace 不能统一展示
- 产品叙事不够集中，容易被理解成“RAG demo + Agent demo”

### 2.3 产品定位偏移风险

如果继续在当前基础上平行扩展两套系统，项目后续会持续出现以下问题：

- 维护成本上升
- 心智负担增加
- 观测系统无法复用
- 面试时难以用一句话说清架构
- 功能越来越多，但系统感反而越来越弱

因此需要在架构层统一。

## 3. 目标产品定位

项目未来应被定义为：

一个面向企业内部知识场景的知识工作流助手。

它不是单纯聊天机器人，也不是通用 Agent 平台。它的工作边界应始终围绕企业知识展开：

- 回答明确知识问答
- 进行多文档综合
- 在证据不足时拒答
- 在召回不足时自动重写与重试
- 在生成后进行 groundedness 或 citation 校验
- 必要时向用户发起澄清

推荐对外表述：

“我把一个传统知识问答项目重构成统一编排的企业知识工作流助手。所有请求先进入图编排层，根据问题意图与证据质量走快路径或工作流路径，前端不仅展示答案，还展示证据、路由、重试与失败原因。”

## 4. 重构目标

本次重构的核心目标如下：

### 4.1 架构目标

- 用一个统一的 LangGraph 作为后端编排入口
- 用一套统一的 Vercel AI SDK 流式协议作为前后端通信标准
- 将现有 `/api/search` 中的 RAG 能力拆解为可复用的 graph nodes
- 将 `/api/agent` 从实验入口升级为主链路入口

### 4.2 产品目标

- 主界面统一为一个知识工作流问答入口
- 系统自动判断走快路径还是复杂工作流路径
- 用户可以看到答案、来源、trace 和失败原因
- Debug 页面保留，但不再承载与主产品割裂的协议体系

### 4.3 工程目标

- 删除自定义 JSONL 主协议
- 消除两套并行后端主链路
- 统一 run log / trace log / route decision 记录方式
- 提升可测性、可观测性和可迭代性

## 5. 非目标

本阶段不追求以下目标：

- 不做通用自治 Agent
- 不接大量外部工具调用
- 不做开放式任务规划器
- 不把所有请求都塞进重型多轮 reasoning
- 不把项目包装成“万能 AI 操作系统”

本项目的复杂性应始终来自企业知识工作流，而不是来自过度设计。

## 6. 设计原则

### 6.1 统一入口，分层处理

所有请求先进入统一 graph，然后在图内部根据意图和证据分流，而不是从接口层就分裂成多个体系。

### 6.2 快路径必须足够轻

统一走 graph 不代表所有请求都走重型 agent 流程。简单问答必须依然保持低延迟、低成本、高可靠。

### 6.3 复杂路径必须可解释

只有当系统真的能够展示路由原因、重写过程、证据选择、回答校验时，复杂工作流才有价值。

### 6.4 观测是产品能力，不是调试副产物

run、trace、evidence、route decision、verification result 都应被视为正式产品能力，而不是开发期日志。

### 6.5 复用现有能力，不做无意义重写

已有 retrieval、rewrite、rerank、run history、Prompt 策略等能力应尽量拆解复用，而不是为追求“统一”而全部报废重写。

## 7. 总体架构

### 7.1 分层图

系统分为五层：

1. UI 层
2. API 层
3. Graph 编排层
4. 能力层
5. 观测与持久化层

### 7.2 UI 层

UI 层使用 Vercel AI SDK `useChat` 与本地状态容器承接流式交互，核心职责：

- 输入问题
- 展示流式文本输出
- 展示来源证据
- 展示 graph trace
- 展示 route 与 verification 结果

建议 UI 由三个区域构成：

- Chat Panel：主问答区
- Trace Panel：节点执行与路由区
- Evidence Panel：文档证据与校验区

### 7.3 API 层

建议未来统一入口为：

- `/api/chat`

短期可以保留 `/api/agent` 作为过渡入口，但不应长期维持 `/api/search` 与 `/api/agent` 并行的主链路设计。

API 层职责：

- 接收前端请求
- 初始化 graph state
- 将 graph 事件映射到 AI SDK stream parts
- 管理请求级上下文，如 workspace、auth、run metadata

### 7.4 Graph 编排层

Graph 是整个系统的中枢。它负责：

- 初始化一次请求
- 做 quick retrieve
- 路由简单或复杂路径
- 触发 rewrite / retry
- 组织 evidence selection
- 触发答案生成
- 做 groundedness verification
- 决定 clarification 或 fallback
- 在结束阶段统一写 run log

### 7.5 能力层

能力层是可复用模块，不负责流程顺序，只负责单点能力：

- embedding / retrieval
- query rewrite
- rerank
- relevance grading
- answer generation
- grounding verification
- fallback message generation

其中部分能力可以继续使用现有自定义函数，部分可以用 LangChain 封装。

### 7.6 观测与持久化层

观测层负责保存：

- run 基础信息
- route decision
- node trace
- timing、token、cost
- evidence snapshot
- final answer
- verification result
- failure reason

该层既服务产品页，也服务调试页。

## 8. 为什么统一走 Graph

统一走 Graph 的核心收益如下：

### 8.1 架构心智模型统一

“所有请求先进入编排层，再在图内部选择路径”比“一个 search 接口 + 一个 agent 接口”更容易理解，也更容易对外表达。

### 8.2 观测体系统一

简单问答和复杂工作流都在同一个 trace 体系里，历史记录、节点信息、错误信息可以复用同一套 UI 和同一套存储模型。

### 8.3 扩展能力自然

后续增加：

- groundedness check
- citation verification
- clarification
- compare / summarize workflow
- route tuning

都可以在 graph 内增量演进，而不是再新开一个系统。

### 8.4 面试表达更高级

“统一编排 + 路由分支 + 可信性校验 + 观测回放”明显比“我有一个常规 RAG 页面，也试了下 LangGraph”更能体现 senior 级别判断。

## 9. 快路径与复杂路径

### 9.1 统一入口后的两条路径

统一走 graph 后，至少保留两条内部路径：

- `fast_qa`
- `workflow_qa`

### 9.2 fast\_qa 定义

适用场景：

- 用户问题明确
- 主要是单点知识查询
- 不需要复杂结构化产出
- 快速检索后证据质量足够高
- 证据不存在明显冲突

目标：

- 低延迟
- 高稳定性
- 高可解释性

### 9.3 workflow\_qa 定义

适用场景：

- 多文档综合
- 对比、汇总、风险分析、清单生成
- 问题语义模糊，需要重写或澄清
- 检索质量不足，需要多步处理
- 需要在生成后做更严格的 groundedness 校验

目标：

- 提升复杂问题完成质量
- 提供更强的 trace 可解释性
- 在证据不足时安全失败

## 10. 路由策略

### 10.1 路由不应纯靠问题表面特征

系统不能简单根据问题长短判断复杂度，也不应把入口判断完全交给一个黑盒 LLM。

推荐做法是混合路由：

- 规则初筛
- quick retrieve 后做 evidence assessment
- 必要时轻量 LLM classifier 补判

### 10.2 规则信号

路由可参考以下信号：

- 是否包含 compare、difference、summary、analysis、checklist、risk 等意图
- 是否要求结构化输出
- 是否存在明显模糊表达
- 是否涉及多个对象或多个制度文档

### 10.3 证据信号

路由还应参考 quick retrieve 的结果：

- top1 / top3 相似度
- 候选片段集中度
- 候选片段之间是否冲突
- 召回数量是否过少
- 是否能从初始证据中看出足够回答基础

### 10.4 推荐的第一版路由标准

直接进入 `fast_qa`：

- 问题明确
- quick retrieve 质量高
- 没有明显综合分析需求
- 证据足以支撑单次回答

进入 `workflow_qa`：

- 需要综合、比较、归纳
- 问题模糊
- 检索召回不足
- 证据冲突
- 需要回答后验证或澄清

进入 `clarification`：

- 问题对象不明确
- 用户表达范围过大
- 无法在当前问题上构造有效检索

进入 `fallback`：

- 尝试后仍证据不足
- 重写和重试已达上限
- 回答无法通过 groundedness 检查

## 11. Graph 状态设计

建议将状态划分为输入态、工作态、输出态和观测态。

### 11.1 输入态

- `userQuestion`
- `history`
- `workspaceId`
- `requestedModel`
- `requestedOptions`

### 11.2 工作态

- `normalizedQuestion`
- `route`
- `rewriteCount`
- `retrievalAttempts`
- `retrievedDocs`
- `rerankedDocs`
- `selectedEvidence`
- `evidenceAssessment`
- `needsClarification`
- `clarificationQuestion`
- `answerDraft`
- `verificationResult`

### 11.3 输出态

- `finalAnswer`
- `finalSources`
- `finalStatus`
- `finalRoute`

### 11.4 观测态

- `runId`
- `requestId`
- `nodeTimings`
- `tokenUsage`
- `costEstimate`
- `traceEvents`

### 11.5 状态设计原则

- graph state 服务编排，不服务 UI 细节
- UI 展示模型应来自 trace events 和衍生状态，而不是将前端组件需求硬塞进 graph state
- state 字段要围绕业务语义命名，而不是围绕实验实现命名

## 12. Graph 节点设计

建议第一阶段统一为以下节点。

### 12.1 `initRun`

职责：

- 标准化请求
- 初始化 requestId、run metadata、默认参数
- 发送 `run_started`

### 12.2 `quickRetrieve`

职责：

- 用最便宜的方式快速检索
- 为 route 决策提供证据基础
- 不直接对用户回答

### 12.3 `routeTask`

职责：

- 综合意图和证据质量决定路径
- 输出 `fast_qa`、`workflow_qa`、`clarification` 或 `fallback`
- 发送 `route_decided`

### 12.4 `rewriteQuery`

职责：

- 在低召回或表达模糊时改写检索问题
- 更新 `normalizedQuestion`
- 记录 rewrite 次数与原因

### 12.5 `retrieveEvidence`

职责：

- 正式检索候选证据
- 支持重试或多轮检索

### 12.6 `rerankEvidence`

职责：

- 对候选证据排序
- 选择更可信的上下文输入生成阶段

### 12.7 `gradeEvidence`

职责：

- 判断证据是否足够
- 判断证据是否冲突
- 判断是否需要拒答、澄清或继续生成

### 12.8 `generateAnswer`

职责：

- 依据 selected evidence 生成答案
- 按 token 形式流式输出文本

### 12.9 `verifyGrounding`

职责：

- 检查生成结果是否被证据支撑
- 判断是否需要降级、拒答、澄清或再次检索

### 12.10 `askClarification`

职责：

- 当问题表达过于模糊时，生成对用户的澄清问题
- 不伪造答案

### 12.11 `fallback`

职责：

- 在证据不足或验证失败后安全结束
- 向用户解释为什么当前不能给出可信答案

### 12.12 `finalizeRun`

职责：

- 写 run history
- 写 trace summary
- 汇总 token / cost / route / sources
- 发送 `run_completed`

## 13. 建议的图路径

### 13.1 fast\_qa

推荐路径：

`initRun -> quickRetrieve -> routeTask -> retrieveEvidence -> rerankEvidence -> generateAnswer -> verifyGrounding -> finalizeRun`

说明：

- 简单路径仍有完整的检索、重排、生成、校验
- 但不引入不必要的复杂评分和循环

### 13.2 workflow\_qa

推荐路径：

`initRun -> quickRetrieve -> routeTask -> rewriteQuery? -> retrieveEvidence -> rerankEvidence -> gradeEvidence -> generateAnswer -> verifyGrounding -> finalizeRun`

必要时分流至：

- `askClarification`
- `fallback`

### 13.3 clarification

路径：

`initRun -> quickRetrieve -> routeTask -> askClarification -> finalizeRun`

### 13.4 fallback

路径：

`... -> fallback -> finalizeRun`

## 14. 复杂任务能力边界

本项目的复杂任务不应泛化成万能 agent 任务，而应聚焦于企业知识工作流。

推荐第一阶段支持的复杂任务：

- 证据不足拒答并解释原因
- 多文档综合
- 结构化总结
- 多文档对比分析
- 生成后 groundedness 校验

暂不建议第一阶段做的复杂任务：

- 任意外部工具编排
- 开放式网页浏览
- 长链自治规划
- 跨系统执行操作

## 15. 流式协议统一策略

### 15.1 目标

前端不再维护自定义 JSONL 解析逻辑，而是统一消费 AI SDK Stream Protocol。

### 15.2 统一原则

- 主产品前端统一使用 `useChat`
- 回答正文优先使用官方 text / message parts
- 工作流 trace、route、evidence、verification 通过自定义 `data-*` parts 承载
- 不把业务事件名误当成官方 protocol part type

### 15.3 官方与业务事件的边界

协议层需要明确区分两层概念：

#### 官方 stream parts

由 AI SDK 协议提供，例如：

- text 相关 parts
- source 相关 parts
- error
- step / finish 相关 parts

#### 业务自定义 data parts

由本项目自定义，用于表达工作流状态，例如：

- `data-route`
- `data-node`
- `data-evidence`
- `data-verification`
- `data-clarification`
- `data-run`

也可以统一为更少的自定义前缀，例如：

- `data-workflow`

再在 payload 中用 `kind` 区分具体语义。

### 15.4 推荐方案

推荐使用以下组合：

- `useChat` 作为主前端 hook
- 正文回答走官方文本 stream parts
- 工作流事件走自定义 `data-*` parts
- 前端先将 `data-*` parts 归一化进 store，再由 UI 按状态渲染

### 15.5 结果

统一后，前端只保留一套正式交互模型：

- `useChat`
- 一套基于 stream parts 和 `data-*` parts 的 reducer
- 一套 trace / evidence / verification 状态模型

## 16. UI 与体验策略

### 16.1 主体验原则

用户首先看到的是一个稳定知识助手，而不是实验平台。

因此主聊天页应优先展示：

- 问题输入
- 答案流式输出
- 来源证据
- 简洁 trace

### 16.2 Trace 展示策略

trace 不是为了暴露所有技术细节，而是为了展示系统决策过程。

主界面可以展示：

- 当前走的是 fast\_qa 还是 workflow\_qa
- 执行了哪些节点
- 是否发生重写、重试、校验失败
- 为什么 fallback

### 16.3 Evidence 展示策略

应展示：

- 命中的文档片段
- rerank 后顺序
- 最终 selected evidence
- verification 是否通过

## 17. 现有代码迁移策略

### 17.1 可以保留并拆分复用的能力

以下能力应尽量保留，但需要从当前目录中拆出，放到更明确的业务边界下：

- `src/app/api/search/route.ts` 中的 retrieval、rewrite、rerank、run metrics 逻辑
- `src/lib/queryRewrite.ts`
- `src/lib/reranker.ts`
- `src/lib/embedClient.ts`
- run history 相关字段设计
- 文档管理、运行记录、Prompt 策略等页面

核心原则不是“保留原文件位置”，而是“保留能力，重组边界”。

### 17.2 需要迁移重构的部分

- 将 `/api/search` 里的大而全 route 拆为 workflow nodes 与 application service
- 将 `/api/agent` 升级或收敛为统一主入口 `/api/chat`
- 将 `src/lib/crag` 从通用 `lib` 迁出，重组为明确的知识工作流业务模块
- 将前端聊天页统一到 AI SDK 协议
- 将 feature-private 的 store 从 `src/store` 迁出
- 将 `src/utils` 中与 `src/lib` 重复的基础设施能力收口

### 17.3 应逐步废弃的部分

- `/api/search` 的自定义 JSONL 主协议
- 前端手工 `reader.read()` + `TextDecoder` 主消费逻辑
- 两套相互独立的问答后端心智模型
- 将核心业务工作流继续堆在 `src/lib` 的做法
- 将 feature-private store 继续堆在 `src/store` 的做法

## 18. 企业级目录与模块边界建议

这一节定义推荐的目标目录结构。目标不是一口气把所有文件搬完，而是先明确每一层的职责边界。

### 18.1 目录职责

#### `src/app`

定义：

- Next.js App Router 的页面入口层

职责：

- `page.tsx`
- `layout.tsx`
- `loading.tsx`
- `error.tsx`
- route-local 的小型展示组件

不应承载：

- 核心业务编排
- 核心工作流实现
- 可脱离路由独立存在的完整业务模块

#### `src/app/api`

定义：

- HTTP 入口层，属于 `app` 的一部分

职责：

- 参数校验
- auth / workspace 上下文初始化
- 调用 feature server 模块
- 返回 JSON 或 stream response

不应承载：

- graph node 实现
- 大型业务编排
- 大量业务分支与流程细节

#### `src/components`

定义：

- 跨页面共享 UI 组件层

职责：

- App shell
- 导航
- Markdown renderer
- 通用 uploader
- 通用 panel / card / list / empty state

不应承载：

- 某个业务域专用组件
- 离开某个 feature 就没有意义的视图

#### `src/lib`

定义：

- 基础设施与跨域共享能力层

职责：

- AI client
- DB client
- provider adapter
- text / runtime helper
- 纯工具函数

不应承载：

- 核心业务工作流
- 跟产品语义强绑定的流程模块
- feature 私有 use case

#### `src/store`

定义：

- 真正全局的客户端状态层

职责：

- app shell 状态
- 用户偏好
- 全局 session 级 UI 状态

不应承载：

- 某个单独功能的私有 Zustand store

#### `src/utils`

建议：

- 逐步取消并收口到 `src/lib`

原因：

- `utils` 容易失控
- 当前已与 `lib` 出现明显职责重复

#### `src/types`

定义：

- 跨功能域共享的公共类型

职责：

- shared DTO
- 通用 response shape
- truly shared client / server contracts

不应承载：

- feature 私有类型
- 组件私有 props

#### `src/features`

定义：

- 业务域实现层

职责：

- feature server logic
- feature components
- feature store
- feature types
- feature tests

这是当前项目最缺的一层，也是本次重构最应该补上的一层。

### 18.2 推荐的目标目录结构

建议后续逐步收敛到如下结构：

- `src/app/`
- `src/app/api/`
- `src/components/`
- `src/features/chat/`
- `src/features/knowledge-workflow/`
- `src/features/documents/`
- `src/features/runs/`
- `src/features/prompts/`
- `src/lib/ai/`
- `src/lib/supabase/`
- `src/lib/text/`
- `src/lib/runtime/`
- `src/store/`
- `src/types/`

### 18.3 `knowledge-workflow` feature 的推荐结构

统一 graph 的核心业务应落在一个明确的业务目录下，而不是继续放在 `src/lib`：

- `src/features/knowledge-workflow/server/graph.ts`
- `src/features/knowledge-workflow/server/state.ts`
- `src/features/knowledge-workflow/server/types.ts`
- `src/features/knowledge-workflow/server/events.ts`
- `src/features/knowledge-workflow/server/nodes/initRun.ts`
- `src/features/knowledge-workflow/server/nodes/quickRetrieve.ts`
- `src/features/knowledge-workflow/server/nodes/routeTask.ts`
- `src/features/knowledge-workflow/server/nodes/rewriteQuery.ts`
- `src/features/knowledge-workflow/server/nodes/retrieveEvidence.ts`
- `src/features/knowledge-workflow/server/nodes/rerankEvidence.ts`
- `src/features/knowledge-workflow/server/nodes/gradeEvidence.ts`
- `src/features/knowledge-workflow/server/nodes/generateAnswer.ts`
- `src/features/knowledge-workflow/server/nodes/verifyGrounding.ts`
- `src/features/knowledge-workflow/server/nodes/askClarification.ts`
- `src/features/knowledge-workflow/server/nodes/fallback.ts`
- `src/features/knowledge-workflow/server/nodes/finalizeRun.ts`

### 18.4 前端相关目录建议

前端不建议继续把工作流私有组件和工作流私有 store 放在全局目录下。

推荐收敛到：

- `src/features/chat/components/ChatPanel.tsx`
- `src/features/chat/components/TracePanel.tsx`
- `src/features/chat/components/EvidencePanel.tsx`
- `src/features/chat/store/chatRuntimeStore.ts`
- `src/features/knowledge-workflow/store/workflowRuntimeStore.ts`

主页面入口仍然保留在：

- `src/app/ask/page.tsx`

但它应只负责组装 feature 组件，而不是承载完整业务逻辑。

### 18.5 当前目录的具体迁移判断

#### 应留在 `app` / `app/api`

- 页面 route files
- API route files

但这些 route 应逐步变薄。

#### 应留在 `components`

- `AppChrome`
- `AppShellNav`
- `MarkdownRenderer`
- `UploadBox`

#### 应从 `components` 迁出

- `AgentStepsPanel`
- `SourcesPanel`

因为它们更接近 AI 业务域组件，而不是全局共享 UI。

#### 应留在 `lib`

- `ai-client`
- `embedClient`
- `supabaseClient`
- `supabaseServer`
- `textChunker`

#### 应从 `lib` 迁出

- `crag/*`
- `queryRewrite`
- `reranker`
- `promptTemplate`
- `workspace`

这些文件虽然能被多个入口复用，但本质上带明显业务域语义。

#### 应从 `store` 迁出

- `chatStore`
- `agentStore`

因为它们并不是真全局状态，而是 feature-private store。

#### 应从 `utils` 收口

- `utils/supabase/*`

应统一并入 `lib/supabase/*` 或等价结构。

## 19. 数据存储建议

建议未来 run 记录至少包含：

- 问题
- route
- final status
- answer
- sources snapshot
- verification result
- trace summary
- token usage
- cost
- duration
- requestId

如果希望支持回放，可继续扩展：

- 全量 trace events
- node output summaries

## 20. 第一阶段实施范围

为了避免重构失控，第一阶段仅实现以下目标：

### 20.1 必做

- 建立统一 graph 入口
- 建立统一 AI SDK 流式协议
- 打通 `fast_qa` 与 `workflow_qa` 两条路径
- 实现 `verifyGrounding`
- 在证据不足时可靠 fallback

### 20.2 可延后

- clarification 体验细化
- 多种复杂任务专用模板
- 更高级的 route classifier
- run trace 回放 UI

## 21. 成功标准

当以下条件达成时，可认为重构成功：

- 不再需要 `/api/search` 作为主产品入口
- 主聊天页与工作流页消费同一套协议
- 用户能看到 route、trace、sources 与 verification
- 简单问答延迟未因统一 graph 明显恶化
- 复杂问题能安全失败而不是胡乱回答
- 面试时能够用一句话说明系统架构

## 22. 面试叙事建议

推荐叙事：

“我没有把 LangGraph 当成噱头，而是把它用作统一编排层。简单问题走高可靠快路径，复杂知识任务走多步工作流。系统不仅输出答案，还展示证据、路由、校验和失败原因，核心目标是让 AI 在企业知识场景里更可信、更可观测。”

不推荐叙事：

- “我做了一个 LangGraph 项目”
- “我把所有请求都 agent 化了”
- “我只是换了一个更高级的框架”

## 23. 风险与应对

### 23.1 风险：统一 graph 后简单路径变重

应对：

- 保证 route 节点和 fast path 足够薄
- 不把重型 LLM judge 放到每个请求的前置路径

### 23.2 风险：trace 太复杂，用户看不懂

应对：

- 主界面只展示关键节点与关键原因
- 更细的调试信息放到 Debug 或详情抽屉

### 23.3 风险：迁移期间双轨并存时间过长

应对：

- 快速建立 `/api/chat`
- 明确 `/api/search` 退场计划
- 避免新功能再落到旧协议上

### 23.4 风险：复杂任务范围过大

应对：

- 第一阶段只做可信性相关复杂能力
- 不把项目扩成通用 agent 平台

## 24. 结论

本项目最合理的演进方向不是保留两套并行系统，也不是把简单知识问答硬改成重型 agent，而是：

- 统一进入一个 LangGraph
- 在图内部区分快路径和复杂路径
- 用 Vercel AI SDK 统一流式协议
- 将可信性、可观测性和失败安全作为核心亮点

这条路线最能兼顾产品完成度、工程合理性和面试叙事强度。
