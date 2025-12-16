/**
 * ⭐ 面试亮点（/runs/[id] 详情页）：
 * 1. 回放单次运行的完整上下文：问题 / 回答 / Agent Steps / Sources / 参数 / 耗时，
 *    形成 AI 系统级的调试与观测能力。
 * 2. 复用 AgentStepsPanel + MarkdownRenderer，体现组件复用与模块化设计。
 */

"use client";

import useSWR from "swr";
import { useParams } from "next/navigation";
import AgentStepsPanel from "@/components/AgentStepsPanel";
import MarkdownRenderer from "@/components/MarkdownRenderer";
import type { AgentStep } from "@/types/agent";

type RunDetail = {
  id: number;
  question: string;
  answer: string | null;
  topk: number | null;
  threshold: number | null;
  matched_count: number | null;
  duration_ms: number | null;
  steps: AgentStep[] | null;
  sources: any[] | null;
  created_at: string;
};

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function RunDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const { data, error, isLoading } = useSWR<RunDetail>(
    id ? `/api/runs/${id}` : null,
    fetcher
  );

  const run = data;

  return (
    <main className="h-[100dvh] max-w-5xl mx-auto flex flex-col bg-gray-100 text-gray-900 border-x">
      <header className="p-4 border-b bg-white flex items-center justify-between">
        <div>
          <h1 className="font-bold text-xl">
            运行详情 {run ? `#${run.id}` : ""}
          </h1>
          {run && (
            <p className="text-xs text-gray-600 mt-1">
              {new Date(run.created_at).toLocaleString()} ·
              TopK: {run.topk ?? "-"} · 阈值: {run.threshold ?? "-"} ·
              命中: {run.matched_count ?? 0} ·
              耗时: {run.duration_ms != null ? `${run.duration_ms} ms` : "-"}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3 text-sm">
          <a href="/runs" className="text-blue-600 hover:underline">
            ← 返回运行列表
          </a>
          <a href="/" className="text-blue-600 hover:underline">
            聊天工作台
          </a>
        </div>
      </header>

      <section className="flex-1 overflow-y-auto p-4 bg-gray-50 space-y-4">
        {isLoading && (
          <div className="text-gray-500 text-sm">加载中...</div>
        )}
        {error && (
          <div className="text-red-500 text-sm">
            加载失败：{String(error)}
          </div>
        )}
        {!isLoading && !error && !run && (
          <div className="text-gray-500 text-sm">未找到该记录。</div>
        )}

        {run && (
          <>
            {/* 问题 & 回答 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white border rounded p-3">
                <div className="text-xs text-gray-500 mb-1">问题</div>
                <div className="text-sm text-gray-900 whitespace-pre-wrap">
                  {run.question}
                </div>
              </div>
              <div className="bg-white border rounded p-3">
                <div className="text-xs text-gray-500 mb-1">回答</div>
                {run.answer ? (
                  <div className="text-sm text-gray-900">
                    <MarkdownRenderer content={run.answer} />
                  </div>
                ) : (
                  <div className="text-sm text-gray-500">暂无回答。</div>
                )}
              </div>
            </div>

            {/* Agent 执行过程（复用 Step 面板） */}
            <div className="bg-white border rounded p-3">
              <AgentStepsPanel steps={(run.steps as AgentStep[]) ?? []} />
            </div>

            {/* 来源片段 */}
            <div className="bg-white border rounded p-3 text-xs">
              <div className="text-xs text-gray-500 mb-2">
                来源片段（共 {run.sources?.length ?? 0} 个）
              </div>
              {(!run.sources || run.sources.length === 0) && (
                <div className="text-gray-500">暂无来源信息。</div>
              )}
              {run.sources &&
                run.sources.map((s: any, idx: number) => (
                  <div key={idx} className="mb-2 border-b last:border-b-0 pb-2">
                    <div className="flex items-center justify-between mb-1">
                      <div className="font-medium text-gray-700">
                        片段 #{idx + 1}
                      </div>
                      <div className="text-[11px] text-gray-500">
                        相似度:{" "}
                        {s.similarity ??
                          s.score ??
                          "-"}
                      </div>
                    </div>
                    <div className="text-[11px] text-gray-800 whitespace-pre-wrap mb-1 max-h-24 overflow-y-auto">
                      {s.content ?? s.snippet ?? ""}
                    </div>
                    {s.document_id && (
                      <a
                        href={`/documents/${s.document_id}?chunk=${s.id}`}
                        className="text-[11px] text-blue-600 hover:underline"
                      >
                        查看所属文档 →
                      </a>
                    )}
                  </div>
                ))}
            </div>
          </>
        )}
      </section>
    </main>
  );
}
