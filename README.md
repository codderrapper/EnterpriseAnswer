# Enterprise Knowledge Hub

Enterprise Knowledge Hub is an enterprise AI knowledge management and question-answering platform for internal document retrieval, grounded answers, and operational visibility. Ask is the primary user workflow.

## Core Modules

- `Dashboard`: 面向管理视角的总览首页，汇总知识库、运行状态和系统入口。
- `Ask`: 面向业务用户的主问答工作台，承接知识检索与答案生成。
- `Documents`: 文档接入与治理中心，管理上传、检索和文档状态。
- `Runs`: 问答运行追踪与排障视图，查看请求、耗时、命中和错误线索。
- `Strategy`: Prompt / 策略版本管理与调优入口。
- `Debug`: 实验与调试区域，承载非主流程能力。

## Technical Highlights

- 企业级 B 端信息架构，区分用户问答端、管理端和调试端。
- 基于 Next.js App Router、React、TypeScript 和 Tailwind CSS 实现的统一产品外壳。
- 以文档接入、知识检索、来源追踪和运行观察为核心的知识平台叙事。
- 支持策略版本管理与问答链路调优，便于演示治理能力而非只展示模型调用。
- 适合作品集展示：突出产品完成度、工程组织和真实企业场景表达。

## Experimental Scope

LangGraph / CRAG 仅作为 `Debug` 下的实验性工作流和调试能力呈现，不是主产品路径，也不是默认问答体验的核心卖点。
