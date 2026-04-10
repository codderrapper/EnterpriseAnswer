"use client";

import AppShellNav from "@/components/AppShellNav";
import Link from "next/link";
import { useState } from "react";

type SearchLabPageProps = {
  showLegacyNotice?: boolean;
};

type Step = {
  id: string;
  title: string;
  status: "pending" | "running" | "done" | "error";
  detail?: string;
};

type Source = {
  id: number;
  document_id: number;
  content: string;
  similarity?: number;
};

const debugSecondaryItems = [
  { href: "/debug", label: "Debug" },
  { href: "/debug/workflow", label: "Workflow Lab" },
  { href: "/debug/search", label: "Search Lab" },
];

function normalizeTopK(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0
    ? Math.min(Math.floor(parsed), 20)
    : 5;
}

function normalizeThreshold(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1 ? parsed : 0.4;
}

function normalizePromptVersion(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : undefined;
}

export default function SearchLabPage({
  showLegacyNotice = false,
}: SearchLabPageProps) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [steps, setSteps] = useState<Step[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const [topKInput, setTopKInput] = useState("5");
  const [thresholdInput, setThresholdInput] = useState("0.4");
  const [model, setModel] = useState("");
  const [promptVersion, setPromptVersion] = useState("");
  const [rewrite, setRewrite] = useState(false);
  const [rerank, setRerank] = useState(false);

  async function runExperiment() {
    const q = question.trim();
    if (!q || isLoading) return;

    const safeTopK = normalizeTopK(topKInput);
    const safeThreshold = normalizeThreshold(thresholdInput);
    const safePromptVersion = normalizePromptVersion(promptVersion);

    setIsLoading(true);
    setAnswer("");
    setSteps([]);
    setSources([]);

    setTopKInput(String(safeTopK));
    setThresholdInput(String(safeThreshold));
    setPromptVersion(
      typeof safePromptVersion === "number" ? String(safePromptVersion) : "",
    );

    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: q,
          history: [],
          topK: safeTopK,
          threshold: safeThreshold,
          model: model.trim() || undefined,
          promptVersion: safePromptVersion,
          rewrite,
          rerank,
        }),
      });

      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || `请求失败 ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let buf = "";
      let content = "";

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        if (!value) continue;

        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;
          const evt = JSON.parse(line);

          if (evt.type === "step") {
            const s = evt.data as Step;
            setSteps((prev) => {
              const idx = prev.findIndex((x) => x.id === s.id);
              if (idx === -1) return [...prev, s];
              const copy = [...prev];
              copy[idx] = { ...copy[idx], ...s };
              return copy;
            });
          } else if (evt.type === "sources") {
            setSources(evt.data ?? []);
          } else if (evt.type === "delta") {
            content += evt.data || "";
            setAnswer(content);
          }
        }
      }
    } catch (err) {
      alert(String((err as Error)?.message || err));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="min-h-screen w-full flex flex-col bg-gray-100 text-gray-900">
      <header className="space-y-3 border-b bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-bold text-xl">Search Lab</h1>
            <p className="text-xs text-gray-500 mt-1">
              调试检索质量、Prompt 版本与 rewrite/rerank 实验开关，结果会写入运行历史
            </p>
          </div>

          {showLegacyNotice ? (
            <Link
              href="/debug/search"
              className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800"
            >
              使用新的 Debug / Search Lab 入口
            </Link>
          ) : null}
        </div>

        <AppShellNav secondaryItems={debugSecondaryItems} />
      </header>

      <section className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-4 p-4 flex-1 min-h-0">
        <div className="bg-white border rounded p-3 space-y-3 overflow-y-auto">
          <div className="text-sm font-medium">实验参数</div>
          <label className="block text-xs text-gray-600">
            TopK
            <input
              type="number"
              min={1}
              max={20}
              value={topKInput}
              onChange={(e) => setTopKInput(e.target.value)}
              onBlur={() => setTopKInput(String(normalizeTopK(topKInput)))}
              className="mt-1 w-full border rounded px-2 py-1 text-sm"
            />
          </label>
          <label className="block text-xs text-gray-600">
            Threshold
            <input
              type="number"
              step={0.05}
              min={0}
              max={1}
              value={thresholdInput}
              onChange={(e) => setThresholdInput(e.target.value)}
              onBlur={() =>
                setThresholdInput(String(normalizeThreshold(thresholdInput)))
              }
              className="mt-1 w-full border rounded px-2 py-1 text-sm"
            />
          </label>
          <label className="block text-xs text-gray-600">
            模型（可空）
            <input
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="例如 gpt-4o-mini"
              className="mt-1 w-full border rounded px-2 py-1 text-sm"
            />
          </label>
          <label className="block text-xs text-gray-600">
            Strategy 版本（可空）
            <input
              value={promptVersion}
              onChange={(e) => setPromptVersion(e.target.value)}
              onBlur={() =>
                setPromptVersion(
                  String(normalizePromptVersion(promptVersion) ?? ""),
                )
              }
              placeholder="例如 3"
              className="mt-1 w-full border rounded px-2 py-1 text-sm"
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={rewrite}
              onChange={(e) => setRewrite(e.target.checked)}
            />
            启用 rewrite
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={rerank}
              onChange={(e) => setRerank(e.target.checked)}
            />
            启用 rerank
          </label>
          <label className="block text-xs text-gray-600">
            问题
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              className="mt-1 w-full h-28 border rounded px-2 py-1 text-sm"
            />
          </label>
          <button
            disabled={isLoading}
            onClick={runExperiment}
            className="w-full px-3 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-400"
          >
            {isLoading ? "执行中..." : "运行实验"}
          </button>
        </div>

        <div className="min-h-0 grid grid-rows-[1fr_220px] gap-4">
          <div className="bg-white border rounded p-3 overflow-y-auto">
            <div className="text-sm font-medium mb-2">回答</div>
            <div className="text-sm whitespace-pre-wrap">{answer || "暂无结果"}</div>
          </div>
          <div className="grid grid-cols-2 gap-4 min-h-0">
            <div className="bg-white border rounded p-3 overflow-y-auto">
              <div className="text-sm font-medium mb-2">步骤</div>
              <div className="space-y-1 text-xs">
                {steps.map((s) => (
                  <div key={s.id} className="border rounded p-2">
                    <div className="font-medium">
                      {s.title} · {s.status}
                    </div>
                    {s.detail ? (
                      <div className="text-gray-600 mt-0.5">{s.detail}</div>
                    ) : null}
                  </div>
                ))}
                {steps.length === 0 && <div className="text-gray-500">暂无步骤</div>}
              </div>
            </div>
            <div className="bg-white border rounded p-3 overflow-y-auto">
              <div className="text-sm font-medium mb-2">来源</div>
              <div className="space-y-2 text-xs">
                {sources.map((s) => (
                  <div key={`${s.id}-${s.document_id}`} className="border rounded p-2">
                    <div className="text-gray-600">
                      doc#{s.document_id} · sim{" "}
                      {typeof s.similarity === "number" ? s.similarity.toFixed(3) : "-"}
                    </div>
                    <div className="text-gray-800 mt-1 line-clamp-4 whitespace-pre-wrap">
                      {s.content}
                    </div>
                  </div>
                ))}
                {sources.length === 0 && <div className="text-gray-500">暂无来源</div>}
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
