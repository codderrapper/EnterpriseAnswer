Engineering Notes · Build vs Runtime & Lazy Initialization

本文记录本项目在 CI / 部署过程中遇到的一个典型工程问题，以及对应的解决方案。
该问题并非业务逻辑错误，而是 构建阶段（build）与运行阶段（runtime）职责混淆 导致的工程问题。

1. 问题背景：为什么本地能跑，CI / 部署却失败？

在项目初期，本地开发一切正常：

npm run dev 可以启动

npm run build 在本地通过

API（Supabase / OpenAI）功能正常

但在 GitHub Actions CI 和 Vercel 部署 中，next build 阶段会报错，例如：

supabaseUrl is required

Missing credentials. Please set AI_API_KEY

Failed to collect page data for /api/*

关键现象

错误发生在 next build 阶段

报错来自 /app/api/*/route.ts

CI 环境没有 .env.local，是一个“干净环境”

2. 根因分析：Next.js build 会 import Route Modules

在 Next.js（尤其是 App Router / Next 15）中：

next build 不只是打包前端页面

它还会 分析并加载 server 端产物

在 Collecting page data 阶段，Route Handler 文件会被 import

这意味着：

只要在模块顶层（top-level）写了有副作用的代码，
就会在 build 阶段被执行。

❌ 错误示例（模块顶层初始化运行时依赖）
// ❌ 在模块 import 时就执行
export const aiClient = new OpenAI({
  apiKey: process.env.AI_API_KEY!,
});

export const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);


在 CI 环境中：

没有 env

import 即执行

build 阶段直接失败

3. 解决方案：Lazy Initialization（延迟初始化）
核心原则

构建阶段不依赖任何运行时资源
模块顶层只能放：

纯常量

纯函数定义

所有依赖 env / 网络 / 密钥的初始化，
必须延迟到“真正处理请求时”执行。

✅ 正确模式：Getter + 缓存（Lazy Init）

以 AI Client 为例：

let _client: OpenAI | null = null;

export function getAIClient() {
  if (_client) return _client;

  const apiKey = process.env.AI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing AI_API_KEY");
  }

  _client = new OpenAI({ apiKey });
  return _client;
}


在 Route Handler 中使用：

export async function POST(req: Request) {
  const aiClient = getAIClient(); // ✅ 运行时才初始化
  // ...
}


同样的模式应用到了：

Supabase Client

Embeddings Client

其它所有第三方 SDK

4. 这种设计带来的工程收益
① CI / Build 可重复性（Buildability）

next build 不再依赖任何密钥

GitHub Actions 可在干净环境稳定构建

符合企业 CI/CD 基本要求

② 运行时错误更清晰（Observability）

缺少 env 时，在请求阶段明确报错

而不是在 build 阶段“莫名其妙失败”

③ 架构职责更清晰

Build：打包、分析、生成产物

Runtime：访问数据库、调用模型、执行业务逻辑

5. 与 AI / 全栈项目的关系

在 AI 项目中，这个问题尤为常见：

OpenAI / Embeddings / Vector DB 都依赖密钥

很多 Demo 项目只能“本地跑”

一上 CI / 云平台就失败

本项目通过 统一的 Lazy Initialization 模式，保证：

AI 能力是 运行时能力

构建阶段完全不依赖外部服务

项目具备真实的“可部署性”

6. 可复用的工程准则（总结）

在 Next.js / SSR / 全栈项目中：

❌ 不要在模块顶层初始化数据库 / AI / 第三方 SDK

✅ 使用 getter + 缓存的惰性初始化

✅ 让 build 阶段只做“纯分析”，runtime 才做“真实执行”

该模式可直接复用于：

Supabase / PostgreSQL / Redis

OpenAI / Claude / 任意 AI Provider

内部 API Client / 微服务 SDK

7. 面试可直接使用的表达

在项目中我遇到过 CI 构建阶段失败的问题，原因是 Next.js build 会 import server route 模块，而我最初在模块顶层初始化了 Supabase 和 AI client。

后来我通过 Lazy Initialization（延迟初始化） 的方式，把所有运行时依赖延迟到 handler 内部创建，并做了 client 缓存，从而保证 build 阶段不依赖任何 env。

这让项目在 GitHub Actions 和 Vercel 上都能稳定构建，也更符合企业级可交付的要求。