/**
 * ⭐ 面试亮点（/runs 列表页）：
 * 1. 基于 SWR + /api/runs 构建“运行历史列表”，展示每次调用的参数、命中、耗时与关键链路指标（TTFB/Retrieve/LLM）。
 * 2. 前端用“规则推断”打出状态标签（OK/无召回/慢/失败），像一个轻量观测台，而不是纯 CRUD。
 * 3. request_id 支持一键复制，方便把一次请求的前后端日志串起来排障。
 */

"use client";

import useSWR from "swr";
import { useMemo, useState } from "react";

type RunListItem = {
  id: number;
  question: string;
  answer: string | null;
  error_code: string | null;
  token_usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  } | null;
  cost_usd: number | null;
  topk: number | null;
  threshold: number | null;
  matched_count: number | null;
  duration_ms: number | null;
  created_at: string;

  // ✅ metrics（你 run_history 已经有这些列了）
  request_id?: string | null;
  ttfb_ms?: number | null;
  embedding_ms?: number | null;
  retrieve_ms?: number | null;
  llm_ms?: number | null;
  best_similarity?: number | null;
};

type RunsResp = {
  items: RunListItem[];
  total: number;
  page: number;
  pageSize: number;
};

const fetcher = (url: string) => fetch(url).then((res) => res.json());

function ms(v: number | null | undefined) {
  return typeof v === "number" ? `${v} ms` : "-";
}

function fmtTokens(v: RunListItem["token_usage"]) {
  if (!v) return "-";
  return `${v.total_tokens} (p:${v.prompt_tokens} / c:${v.completion_tokens})`;
}

function fmtCost(v: number | null | undefined) {
  return typeof v === "number" ? `$${v.toFixed(6)}` : "-";
}

function toLocalTime(ts: string) {
  const d = new Date(ts);
  const date = d.toLocaleDateString();
  const time = d.toLocaleTimeString();
  return { date, time };
}

function StatusPill({
  kind,
}: {
  kind: "ok" | "empty" | "slow" | "fail";
}) {
  const map: Record<typeof kind, { text: string; cls: string }> = {
    ok: { text: "OK", cls: "bg-green-50 text-green-700 border-green-200" },
    empty: { text: "无召回", cls: "bg-yellow-50 text-yellow-700 border-yellow-200" },
    slow: { text: "慢", cls: "bg-orange-50 text-orange-700 border-orange-200" },
    fail: { text: "失败", cls: "bg-red-50 text-red-700 border-red-200" },
  };

  const it = map[kind];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-xs rounded-full border ${it.cls}`}>
      {it.text}
    </span>
  );
}

export default function RunsPage() {
  const [page, setPage] = useState(1);

  const query = `/api/runs?page=${page}&pageSize=20`;
  const { data, error, isLoading } = useSWR<RunsResp>(query, fetcher);

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const pageSize = data?.pageSize ?? 20;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // ✅ 规则：推断状态（不需要后端改动）
  // - fail：answer 为空且 duration 为空（或 duration 极小但没有 answer），通常是异常/中断
  // - empty：matched_count=0 或 best_similarity < threshold（如果 best_similarity 有）
  // - slow：duration_ms >= 2000（你可以调整阈值）
  // - ok：其它
  const computed = useMemo(() => {
    return items.map((r) => {
      const matched = r.matched_count ?? 0;
      const dur = r.duration_ms ?? null;
      const hasAnswer = typeof r.answer === "string" && r.answer.trim().length > 0;

      let kind: "ok" | "empty" | "slow" | "fail" = "ok";

      if (!hasAnswer && (dur == null || dur < 50)) {
        kind = "fail";
      } else if (matched === 0) {
        kind = "empty";
      } else if (
        typeof r.best_similarity === "number" &&
        typeof r.threshold === "number" &&
        r.best_similarity < r.threshold
      ) {
        kind = "empty";
      } else if (typeof dur === "number" && dur >= 2000) {
        kind = "slow";
      } else {
        kind = "ok";
      }

      return { ...r, _kind: kind };
    });
  }, [items]);

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // ignore
    }
  };

  return (
    <main className="h-[100dvh] max-w-6xl mx-auto flex flex-col bg-gray-100 text-gray-900 border-x">
      <header className="p-4 border-b bg-white flex items-center justify-between">
        <div>
          <h1 className="font-bold text-xl">运行历史</h1>
          <div className="text-xs text-gray-500 mt-1">
            轻量观测台：状态 / 命中 / 耗时 / TTFT / Retrieve / LLM / request_id
          </div>
        </div>

        <div className="flex items-center gap-3 text-sm">
          <a href="/" className="text-blue-600 hover:underline">
            聊天工作台
          </a>
          <a href="/documents" className="text-blue-600 hover:underline">
            文档管理
          </a>
        </div>
      </header>

      <section className="flex-1 overflow-y-auto p-4 bg-gray-50">
        {isLoading && <div className="text-gray-500 text-sm">加载中...</div>}

        {error && (
          <div className="text-red-500 text-sm">
            加载失败：{String((error as any)?.message ?? error)}
          </div>
        )}

        {!isLoading && !error && computed.length === 0 && (
          <div className="text-gray-500 text-sm">
            暂无运行记录，先去首页提问几次吧。
          </div>
        )}

        {computed.length > 0 && (
          <div className="overflow-x-auto rounded border bg-white">
            <table className="w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-3 py-2 text-left border-b w-[140px]">时间</th>
                  <th className="px-3 py-2 text-left border-b w-[84px]">状态</th>
                  <th className="px-3 py-2 text-left border-b">问题</th>
                  <th className="px-3 py-2 text-center border-b w-[70px]">命中</th>
                  <th className="px-3 py-2 text-center border-b w-[90px]">总耗时</th>
                  <th className="px-3 py-2 text-center border-b w-[90px]">TTFT(Time To First Token)</th>
                  <th className="px-3 py-2 text-center border-b w-[90px]">Retrieve</th>
                  <th className="px-3 py-2 text-center border-b w-[90px]">LLM</th>
                  <th className="px-3 py-2 text-left border-b w-[160px]">Tokens</th>
                  <th className="px-3 py-2 text-left border-b w-[120px]">Cost</th>
                  <th className="px-3 py-2 text-left border-b w-[120px]">Error</th>
                  <th className="px-3 py-2 text-left border-b w-[150px]">参数</th>
                  <th className="px-3 py-2 text-left border-b w-[210px]">request_id</th>
                  <th className="px-3 py-2 text-center border-b w-[70px]">操作</th>
                </tr>
              </thead>

              <tbody>
                {computed.map((run) => {
                  const t = toLocalTime(run.created_at);
                  const answerPreview =
                    (run.answer ?? "").replace(/\s+/g, " ").slice(0, 80) ||
                    "-";

                  return (
                    <tr key={run.id} className="border-b last:border-b-0 hover:bg-gray-50">
                      <td className="px-3 py-2 align-top whitespace-nowrap">
                        <div className="text-xs text-gray-500">{t.date}</div>
                        <div className="font-medium">{t.time}</div>
                      </td>

                      <td className="px-3 py-2 align-top">
                        <div className="flex flex-col gap-1">
                          <StatusPill kind={(run as any)._kind} />
                          {/* 小提示：hover 看预览 */}
                          <span className="text-[11px] text-gray-400" title={answerPreview}>
                            悬停看答复
                          </span>
                        </div>
                      </td>

                      <td className="px-3 py-2 align-top min-w-[280px]">
                        <div className="font-medium truncate" title={run.question}>
                          {run.question}
                        </div>
                        <div className="text-xs text-gray-500 truncate" title={answerPreview}>
                          {answerPreview}
                        </div>
                      </td>

                      <td className="px-3 py-2 align-top text-center">
                        {run.matched_count ?? 0}
                      </td>

                      <td className="px-3 py-2 align-top text-center">
                        {ms(run.duration_ms)}
                      </td>

                      <td className="px-3 py-2 align-top text-center">
                        {ms(run.ttfb_ms)}
                      </td>

                      <td className="px-3 py-2 align-top text-center">
                        {ms(run.retrieve_ms)}
                      </td>

                      <td className="px-3 py-2 align-top text-center">
                        {ms(run.llm_ms)}
                      </td>

                      <td className="px-3 py-2 align-top text-xs">
                        {fmtTokens(run.token_usage)}
                      </td>

                      <td className="px-3 py-2 align-top text-xs">
                        {fmtCost(run.cost_usd)}
                      </td>

                      <td className="px-3 py-2 align-top text-xs">
                        {run.error_code ?? "-"}
                      </td>

                      <td className="px-3 py-2 align-top text-xs">
                        <div>TopK: {run.topk ?? "-"}</div>
                        <div>阈值: {run.threshold ?? "-"}</div>
                        <div>
                          Best:{" "}
                          {typeof run.best_similarity === "number"
                            ? run.best_similarity.toFixed(3)
                            : "-"}
                        </div>
                      </td>

                      <td className="px-3 py-2 align-top text-xs">
                        {run.request_id ? (
                          <div className="flex items-center gap-2">
                            <span className="truncate max-w-[140px]" title={run.request_id}>
                              {run.request_id}
                            </span>
                            <button
                              type="button"
                              onClick={() => copy(run.request_id!)}
                              className="px-2 py-1 rounded border bg-white hover:bg-gray-50 text-[11px]"
                              title="复制 request_id"
                            >
                              复制
                            </button>
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>

                      <td className="px-3 py-2 align-top text-center">
                        <a
                          href={`/runs/${run.id}`}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          详情
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <footer className="p-3 border-t bg-white flex items-center justify-between text-xs text-gray-600">
        <div>
          共 {total} 条 · 第 {page} / {totalPages} 页
        </div>
        <div className="flex items-center gap-2">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className={`px-2 py-1 rounded border ${
              page <= 1
                ? "text-gray-400 bg-gray-50 cursor-not-allowed"
                : "bg-white hover:bg-gray-50"
            }`}
          >
            上一页
          </button>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className={`px-2 py-1 rounded border ${
              page >= totalPages
                ? "text-gray-400 bg-gray-50 cursor-not-allowed"
                : "bg-white hover:bg-gray-50"
            }`}
          >
            下一页
          </button>
        </div>
      </footer>
    </main>
  );
}
