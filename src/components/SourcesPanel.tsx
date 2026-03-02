"use client";

import type { Source } from "@/types/chat";

/**
 * ⭐ 面试亮点（SourcesPanel）：
 * 1) 将 RAG 检索结果（TopK chunks + similarity）从“隐藏在 message 里”提升为“可解释面板”；
 * 2) 显式展示阈值与相似度分级，让“为什么回答这样”变得可解释；
 * 3) 组件可复用：聊天页与 Run 回放页都能用（工程化复用点）。
 */

function normalizeText(s: string) {
  return (s ?? "").replace(/\s+/g, " ").trim();
}

function clampText(s: string, n: number) {
  const t = normalizeText(s);
  return t.length > n ? t.slice(0, n) + "…" : t;
}

export default function SourcesPanel({
  sources,
  threshold,
}: {
  sources: Source[];
  threshold: number;
}) {
  if (!sources?.length) {
    return (
      <aside className="bg-white border rounded p-3 text-xs text-gray-600">
        <div className="font-medium text-gray-800 mb-1">📌 本次召回片段</div>
        <div className="text-gray-500">暂无来源（未召回或仍在生成中）</div>
      </aside>
    );
  }

  // ✅ 按相似度降序排序（null 放最后）
  const sorted = [...sources].sort((a, b) => {
    const av = a.similarity ?? -999;
    const bv = b.similarity ?? -999;
    return bv - av;
  });

  const bestRaw = sorted[0]?.similarity ?? null;
  const best = typeof bestRaw === "number" ? bestRaw : Number(bestRaw);
  const bestNum = Number.isFinite(best) ? best : null;

  return (
    <aside className="bg-white border rounded p-3 text-xs text-gray-700">
      <div className="flex items-center justify-between mb-2">
        <div className="font-medium text-gray-800">📌 本次召回片段（TopK）</div>
        <div className="text-[11px] text-gray-500">
          阈值：{threshold.toFixed(2)}
        </div>
      </div>

      <div className="text-[11px] text-gray-500 mb-2">
        {bestNum == null
          ? "最高相似度：-"
          : `最高相似度：${bestNum.toFixed(3)}`}{" "}
      </div>

      <div className="space-y-2">
        {sorted.map((s) => {
          const simRaw = s.similarity;
          const simNum = typeof simRaw === "number" ? simRaw : Number(simRaw);
          const sim = Number.isFinite(simNum) ? simNum : null;

          const pass = sim != null && sim >= threshold;

          return (
            <div
              key={String(s.id)}
              className={`rounded border p-2 ${
                pass ? "bg-white" : "bg-gray-50 opacity-70"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="text-[11px] text-gray-500 truncate">
                  doc #{s.document_id} · chunk #{s.id}
                </div>
                <div
                  className={`text-[11px] font-medium ${
                    pass ? "text-green-700" : "text-gray-500"
                  }`}
                  title="向量相似度（越大越相关）"
                >
                  sim {sim == null ? "-" : sim.toFixed(3)}{" "}
                </div>
              </div>

              <div
                className="mt-1 text-gray-800"
                title={normalizeText(s.snippet)}
              >
                {clampText(s.snippet, 140)}
              </div>

              <div className="mt-1 flex items-center justify-between">
                <a
                  href={`/documents/${s.document_id}?chunk=${s.id}`}
                  className="text-blue-600 hover:underline"
                >
                  查看文档位置 →
                </a>
                {!pass && (
                  <span className="text-[11px] text-gray-500">低于阈值</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
