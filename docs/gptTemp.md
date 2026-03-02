模块 1：稳定性（1～2 天）

目标：系统不会因为重复上传、重复点击、失败重试就把数据写乱。

要做的内容（我会带你一步步做）：

上传链路幂等

给 document 做 content_hash（或 file_hash）

同一个文件重复上传：不重复入库（返回“已存在”）

对面试讲法：“避免重复向量化，省钱 + 防脏数据”

上传→切片→embedding→入库 的“事务/补偿”

你现在很可能是：documents 插了，但 chunks 失败了 → 半成品

做法：用 status 字段（processing/ready/failed），失败可重试

对面试讲法：“把 AI pipeline 当成生产任务，具备可恢复性”

错误兜底 & 用户提示

API 返回结构统一（哪怕你是 JSONL，也要 error 事件统一结构）

前端收到 error 能展示“哪里失败：embedding/retrieve/llm”

对面试讲法：“黑盒变灰盒，用户体验更像企业产品”

✅ 这块不用登录、不用 RLS，也不用后端重构。

模块 2：效果提升（RAG 质量，2～3 天）

目标：回答更准，尤其是“问得不清楚/关键词不匹配”的情况。

只做 2 件“最有用且不复杂”的：

混合检索（关键词 + 向量）

向量适合语义，关键词适合专有名词/编号/制度条款

做法：在 match_documents 前加一个简单 ilike/tsvector 的 keyword 检索，然后合并去重

对面试讲法：“不是迷信向量，真实企业检索必须混合”

Rerank（轻量版）

你现在是按 similarity 排序

轻量 rerank 做法：用 LLM 对 topK 的片段打分重排（只对 5～10 条，成本可控）

对面试讲法：“召回和排序分层，提升准确率”

✅ 这块也不需要 LangGraph，先把效果提升做扎实。

模块 3：观测台补完（1～2 天）

你已经做了 metrics + run 回放，下一步不是“搞监控平台”，而是把你已有的 run_history 做得更像监控台：

runs 列表页增加 “失败标识/慢请求标识”

失败：error step / answer 为 null / matched_count=0

慢：duration_ms > 某阈值

不一定要筛选器，先做标识就很像“生产系统”

run 详情页展示请求链路

request_id（可复制）

steps 每一步耗时（你现在 steps detail 里已经带了耗时文本，我们可以规范成字段）

sources 里高亮 best_similarity 的 top1

成本（非常轻量）

估算 token（不用 100% 精确）

run_history 加 prompt_tokens / completion_tokens / total_tokens（可以先存 null，后面补）

对面试讲法：“控成本不是口号，我能落到数据”


codex
身份认证 + 多租户隔离
1.1 Supabase Auth 或自建 Auth
1.2 workspace_id 全表覆盖，开启 RLS 策略
1.3 服务端用 service role 处理写入，客户端只用 anon
可靠性与成本控制
2.1 上传 → 异步队列 → 嵌入任务（BullMQ/Trigger + cron）
2.2 重试与幂等、失败状态回写
2.3 限流 + 配额 + 最大上下文限制
观测与治理
3.1 结构化日志、request-id、Sentry/OTel
3.2 run_history 增加 error_code、token_usage、cost
工程质量
4.1 Zod 校验 API 输入
4.2 单测 + 集成测试 + e2e（Playwright）


langgraph