1) 总览路径图（Vercel 托管版）
[Browser]
  |
  | ① https://your-domain.com  (DNS: CNAME -> Vercel Edge / A Record)
  v
[DNS Resolver]
  |
  v
[Vercel Edge / CDN]
  |
  | ② 请求页面 / 静态资源（可能命中边缘缓存）
  | ③ 请求 API: POST /api/search  (streaming)
  v
[Next.js Runtime on Vercel]
  |
  | ④ Route Handler /app/api/search/route.ts
  |    - 解析输入（question + history + options）
  |    - 写入 run_history: status=pending
  |
  | ⑤ RAG Retrieval
  |    - embed(question)
  |    - Supabase RPC: match_documents
  |    - 得到 chunks + sources
  |
  | ⑥ Prompt Assemble
  |    - system + context(chunks) + user(question)
  |
  | ⑦ LLM Streaming
  |    - 调用模型，获取 token stream
  |    - 组装 JSONL 事件：step / sources / delta / error
  |
  | ⑧ ReadableStream 输出（chunk-by-chunk）
  v
[Browser Fetch + Stream Parser]
  |
  | ⑨ 逐行解析 JSONL
  |    - delta -> 更新“打字效果”
  |    - step  -> 更新 StepPanel（running/done/error）
  |    - sources -> 渲染来源卡片
  |
  v
[UI: Chat + Steps + Sources]
  |
  | ⑩ 完成后写回 run_history: answer/steps/sources
  v
[Runs Replay Page]


你可以这样一句话解释：

“域名指到 Vercel，页面由 CDN 分发，API 进入 Next Route Handler；后端先做 RAG 检索，再流式调用模型，把 token 以 JSONL 事件流推到前端，前端边解析边更新 UI，并把 steps/sources 写入 run_history 做回放。”

2) 总览路径图（自部署版：Nginx + Node + Next）

这个是企业更常见的“私有化”形态，你需要能讲清楚。

[Browser]
  |
  | ① https://your-domain.com
  v
[DNS] (A record -> Server Public IP)
  |
  v
[Server: Nginx :443]
  |
  | ② TLS 终止（证书：Let's Encrypt）
  | ③ 反向代理：/ -> Next.js (Node)  /api/* -> Next Route Handlers
  | ④ 关键：关闭 buffering，保证 streaming 不被攒包
  v
[Next.js on Node:3000]
  |
  | ⑤ /app/api/search/route.ts 生成 ReadableStream
  |    - embed -> supabase rpc -> prompt -> llm stream
  |
  v
[Nginx Proxy to Browser]
  |
  | ⑥ 按 chunk 立刻转发（不缓存、不合并）
  v
[Browser Stream Parser]
  |
  v
[UI 实时更新（delta/step/sources）]


自部署里最关键的“面试点”就一句话：

“为了 AI 流式输出，Nginx 必须禁用 proxy_buffering，否则会把流攒成整段，前端就看不到实时 token。”

3) AI Streaming 的“数据流协议图”（你项目的核心亮点）

你现在的系统已经在走 “Run → Steps → Final” 的事件流，这个结构化是你项目最能打的点。

Server -> Client (HTTP Response Body, Streaming)

event: step
{ type: "step", id: "retrieve", status: "running" }

event: sources
{ type: "sources", items: [...] }

event: delta
{ type: "delta", text: "..." }   (重复多次)

event: step
{ type: "step", id: "llm", status: "done" }

event: final
{ type: "final", answer: "...", runId: 123 }


前端对应就是：

delta：更新 chat bubble（打字）

step：更新 StepPanel（pending/running/done/error）

sources：渲染引用卡片

final：收尾、落库、可回放

4) 你可以用来“反杀”的一句话（非常实用）

面试官问：“你怎么保证线上 streaming 稳定？”

你答：

“streaming 端到端必须保证中间层不做 buffering。Vercel 场景天然支持；自部署场景用 Nginx 做反向代理时需要关闭 proxy_buffering，并确保 proxy_http_version 1.1、合理的超时设置。前端用 JSONL 事件流解析，出现中断也能在 Run/Steps 里定位是哪一步失败。”