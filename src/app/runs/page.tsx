/**
 * ⭐ 面试亮点（/runs 列表页）：
 * 1. 基于 SWR + /api/runs 构建“运行历史列表”，可查看每次调用的参数、命中情况、耗时、问答预览。
 * 2. 体现 AI 系统的可观测性（Observability），而不是简单的“黑盒调用大模型”。
 */

"use client";

import useSWR from "swr";
import { useState } from "react";

type RunListItem = {
  id: number;
  question: string;
  answer: string | null;
  topk: number | null;
  threshold: number | null;
  matched_count: number | null;
  duration_ms: number | null;
  created_at: string;
};

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function RunsPage() {
  const [page, setPage] = useState(1);

  const query = `/api/runs?page=${page}&pageSize=20`;
  const { data, error, isLoading } = useSWR(query, fetcher);

  const items: RunListItem[] = data?.items ?? [];
  const total: number = data?.total ?? 0;
  const pageSize: number = data?.pageSize ?? 20;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <main className="h-[100dvh] max-w-5xl mx-auto flex flex-col bg-gray-100 text-gray-900 border-x">
      <header className="p-4 border-b bg-white flex items-center justify-between">
        <h1 className="font-bold text-xl">运行历史</h1>
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
        {isLoading && (
          <div className="text-gray-500 text-sm">加载中...</div>
        )}
        {error && (
          <div className="text-red-500 text-sm">
            加载失败：{String(error)}
          </div>
        )}

        {!isLoading && !error && items.length === 0 && (
          <div className="text-gray-500 text-sm">
            暂无运行记录，先去首页提问几次吧。
          </div>
        )}

        {items.length > 0 && (
          <div className="overflow-x-auto rounded border bg-white">
            <table className="w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-3 py-2 text-left border-b w-20">时间</th>
                  <th className="px-3 py-2 text-left border-b">问题</th>
                  <th className="px-3 py-2 text-left border-b w-40">
                    回答预览
                  </th>
                  <th className="px-3 py-2 text-left border-b w-28">
                    参数
                  </th>
                  <th className="px-3 py-2 text-left border-b w-24">
                    命中数
                  </th>
                  <th className="px-3 py-2 text-left border-b w-24">
                    耗时
                  </th>
                  <th className="px-3 py-2 text-left border-b w-20">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((run) => (
                  <tr key={run.id} className="border-b last:border-b-0">
                    <td className="px-3 py-2 align-top whitespace-nowrap">
                      {new Date(run.created_at).toLocaleTimeString()}
                    </td>
                    <td className="px-3 py-2 align-top max-w-xs">
                      <div className="truncate" title={run.question}>
                        {run.question}
                      </div>
                    </td>
                    <td className="px-3 py-2 align-top max-w-xs">
                      <div
                        className="truncate text-gray-700"
                        title={run.answer ?? ""}
                      >
                        {run.answer ?? "-"}
                      </div>
                    </td>
                    <td className="px-3 py-2 align-top text-xs">
                      <div>TopK: {run.topk ?? "-"}</div>
                      <div>阈值: {run.threshold ?? "-"}</div>
                    </td>
                    <td className="px-3 py-2 align-top text-center">
                      {run.matched_count ?? 0}
                    </td>
                    <td className="px-3 py-2 align-top text-center">
                      {run.duration_ms != null
                        ? `${run.duration_ms} ms`
                        : "-"}
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
                ))}
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
