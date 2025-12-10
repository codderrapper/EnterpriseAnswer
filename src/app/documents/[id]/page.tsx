/**
 * ⭐ 面试亮点（/documents/[id] 文档详情页）：
 * 1. 左侧展示 documents.content 的全文（用 MarkdownRenderer 渲染），右侧展示所有分片（document_chunks），形成完整的 RAG 文档可视化视图。
 * 2. 支持通过 URL 查询参数 (?chunk=xxx) 高亮指定分片，可与 Chat 页“来源片段”实现打通，构建从回答 → 文档 → 具体 chunk 的可追溯链路。
 * 3. 完全基于真实表结构（name + content + chunks），提升排查 RAG 问题、调试向量切片质量的效率。
 */

"use client";

import useSWR from "swr";
import { useSearchParams, useParams } from "next/navigation";
import MarkdownRenderer from "@/components/MarkdownRenderer";

type DocumentRow = {
  id: number;
  name: string;
  content: string;
  created_at: string;
};

type ChunkRow = {
  id: number;
  document_id: number;
  content: string;
};

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function DocumentDetailPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const selectedChunkId = searchParams.get("chunk");

  const id = params.id;
  const { data, error, isLoading } = useSWR(
    id ? `/api/documents/${id}` : null,
    fetcher
  );

  const doc: DocumentRow | undefined = data?.document;
  const chunks: ChunkRow[] = data?.chunks ?? [];

  return (
    <main className="h-[100dvh] max-w-5xl mx-auto flex flex-col bg-gray-100 text-gray-900 border-x">
      {/* 顶部标题 */}
      <header className="p-4 border-b bg-white flex items-center justify-between">
        <div>
          <h1 className="font-bold text-xl">
            文档详情 {doc ? `#${doc.id}` : ""}
          </h1>
          {doc?.name && (
            <p className="text-sm text-gray-600 mt-1 truncate max-w-[320px]">
              {doc.name}
            </p>
          )}
        </div>
        <a href="/documents" className="text-sm text-blue-600 hover:underline">
          ← 返回文档列表
        </a>
      </header>

      {/* 主体区域 */}
      <section className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
        {isLoading && (
          <div className="text-gray-500 text-sm">加载中...</div>
        )}
        {error && (
          <div className="text-red-500 text-sm">
            加载失败：{String(error)}
          </div>
        )}
        {!isLoading && !error && !doc && (
          <div className="text-gray-500 text-sm">未找到该文档。</div>
        )}

        {doc && (
          <>
            {/* 基本信息 */}
            <div className="bg-white border rounded p-3 text-sm flex flex-wrap gap-x-8 gap-y-1">
              <div>
                <span className="text-gray-500">名称：</span>
                <span>{doc.name}</span>
              </div>
              <div>
                <span className="text-gray-500">创建时间：</span>
                <span>{new Date(doc.created_at).toLocaleString()}</span>
              </div>
              <div>
                <span className="text-gray-500">分片数：</span>
                <span>{chunks.length}</span>
              </div>
            </div>

            {/* 左右布局 */}
            <div className="grid grid-cols-1 md:grid-cols-[2fr,1fr] gap-4">
              {/* 左：全文（documents.content） */}
              <div className="bg-white border rounded p-3 max-h-[70vh] overflow-y-auto">
                <div className="text-xs text-gray-500 mb-2">
                  文档原文（来自 documents.content）
                </div>
                {doc.content ? (
                  <MarkdownRenderer content={doc.content} />
                ) : (
                  <div className="text-sm text-gray-500">
                    暂无内容。
                  </div>
                )}
              </div>

              {/* 右：分片列表（document_chunks） */}
              <div className="bg-white border rounded p-3 max-h-[70vh] overflow-y-auto text-xs">
                <div className="text-xs text-gray-500 mb-2 flex items-center justify-between">
                  <span>分片列表（共 {chunks.length} 个）</span>
                  {selectedChunkId && (
                    <span className="text-[11px] text-blue-600">
                      当前高亮：chunk #{selectedChunkId}
                    </span>
                  )}
                </div>
                {chunks.length === 0 && (
                  <div className="text-gray-500 text-xs">
                    暂无分片数据。
                  </div>
                )}
                {chunks.map((chunk, index) => {
                  const isSelected =
                    selectedChunkId &&
                    String(chunk.id) === String(selectedChunkId);
                  return (
                    <div
                      key={chunk.id}
                      className={`border rounded p-2 mb-2 ${
                        isSelected
                          ? "border-blue-500 bg-blue-50"
                          : "border-gray-200 bg-gray-50"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="font-medium text-gray-700">
                          Chunk #{index + 1}
                        </div>
                        <div className="text-[11px] text-gray-500">
                          id: {chunk.id}
                        </div>
                      </div>
                      <div className="text-gray-800 whitespace-pre-wrap text-[11px] max-h-32 overflow-y-auto">
                        {chunk.content}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
