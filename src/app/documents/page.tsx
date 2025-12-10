/**
 * ⭐ 面试亮点（/documents 文档列表页）：
 * 1. 使用 SWR 构建“文档数据层”，支持搜索 + 分页 + 手动刷新，而不是简单的 useEffect + fetch。
 * 2. 列表字段完全基于真实业务表：id / name / created_at / content_preview / chunk_count，
 *    方便业务方快速了解文档规模和拆分情况。
 * 3. 复用 UploadBox，并通过 onUploaded 与列表刷新联动，体现组件复用与数据流设计能力。
 */

"use client";

import useSWR from "swr";
import { useState } from "react";
import UploadBox from "@/components/UploadBox";

type DocumentListItem = {
  id: number;
  name: string;
  created_at: string;
  content_preview: string;
  chunk_count: number;
};

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function DocumentsPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const query = `/api/documents?search=${encodeURIComponent(
    search
  )}&page=${page}&pageSize=20`;

  const { data, error, isLoading, mutate } = useSWR(query, fetcher);

  const items: DocumentListItem[] = data?.items ?? [];
  const total: number = data?.total ?? 0;
  const pageSize: number = data?.pageSize ?? 20;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <main className="h-[100dvh] max-w-4xl mx-auto flex flex-col bg-gray-100 text-gray-900 border-x">
      {/* 顶部标题 & 返回入口 */}
      <header className="p-4 border-b bg-white flex items-center justify-between">
        <h1 className="font-bold text-xl">文档管理</h1>
        <a href="/" className="text-sm text-blue-600 hover:underline">
          ← 返回聊天
        </a>
      </header>

      {/* 搜索 + 上传区域 */}
      <div className="p-4 space-y-3 bg-gray-50 border-b">
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">
              搜索文档名称
            </label>
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="输入 name 关键字..."
              className="w-full border rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          <button
            onClick={() => mutate()}
            className="px-3 py-1 text-xs rounded border bg-white hover:bg-gray-50"
          >
            手动刷新
          </button>
        </div>

        {/* 复用 UploadBox，上传成功后刷新列表 */}
        <UploadBox
          onUploaded={() => {
            mutate();
          }}
        />
      </div>

      {/* 列表区域 */}
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
            暂无文档，请先上传文件。
          </div>
        )}

        {items.length > 0 && (
          <div className="overflow-x-auto rounded border bg-white">
            <table className="w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-3 py-2 text-left border-b w-10">ID</th>
                  <th className="px-3 py-2 text-left border-b">名称</th>
                  <th className="px-3 py-2 text-left border-b w-24">
                    分片数
                  </th>
                  <th className="px-3 py-2 text-left border-b w-64">
                    内容预览
                  </th>
                  <th className="px-3 py-2 text-left border-b w-40">
                    创建时间
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((doc) => (
                  <tr key={doc.id} className="border-b last:border-b-0">
                    <td className="px-3 py-2 align-top">{doc.id}</td>
                    <td className="px-3 py-2 align-top max-w-xs">
                      <a
                        href={`/documents/${doc.id}`}
                        className="text-blue-600 hover:underline truncate inline-block max-w-xs"
                        title={doc.name}
                      >
                        {doc.name}
                      </a>
                    </td>
                    <td className="px-3 py-2 align-top">
                      {doc.chunk_count}
                    </td>
                    <td className="px-3 py-2 align-top max-w-xs">
                      <span className="text-gray-700 truncate inline-block max-w-xs">
                        {doc.content_preview || "-"}
                      </span>
                    </td>
                    <td className="px-3 py-2 align-top">
                      {new Date(doc.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 分页区域 */}
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
