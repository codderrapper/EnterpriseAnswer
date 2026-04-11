"use client";

import AppShellNav from "@/components/AppShellNav";
import Link from "next/link";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";

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

type PromptItem = {
  id: number;
  version: number;
  content: string;
  top_k: number | null;
  threshold: number | null;
  is_active: boolean;
};

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const debugSecondaryItems = [
  { href: "/debug", label: "Debug" },
  { href: "/debug/workflow", label: "Workflow Lab" },
  { href: "/debug/search", label: "Search Lab" },
];

function normalizeTopK(value: string | null) {
  if (!value) return 5;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0
    ? Math.min(Math.floor(parsed), 20)
    : 5;
}

function normalizeThreshold(value: string | null) {
  if (!value) return 0.4;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1 ? parsed : 0.4;
}

function normalizePromptVersion(value: string | null) {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : undefined;
}

/**
 * ⚡ 内部组件：负责具体的业务逻辑和渲染
 */
function SearchLabContent({
  showLegacyNotice = false,
}: SearchLabPageProps) {
  const searchParams = useSearchParams();

  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [steps, setSteps] = useState<Step[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [topKInput, setTopKInput] = useState("5");
  const [thresholdInput, setThresholdInput] = useState("0.4");
  const [model, setModel] = useState("");
  const [promptVersion, setPromptVersion] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [rewrite, setRewrite] = useState(false);
  const [rerank, setRerank] = useState(false);

  // 🧠 获取现有策略用于快速对比
  const { data: promptsData } = useSWR<{ items: PromptItem[] }>(
    "/api/prompts?name=search_system",
    fetcher
  );

  const promptItems = promptsData?.items ?? [];

  // ⚡ 逻辑：监听 URL 参数并初始化状态
  useEffect(() => {
    const q = searchParams.get("question");
    const tk = searchParams.get("topK");
    const th = searchParams.get("threshold");
    const pv = searchParams.get("promptVersion");

    if (q) setQuestion(q);
    if (tk) setTopKInput(String(normalizeTopK(tk)));
    if (th) setThresholdInput(String(normalizeThreshold(th)));
    if (pv) setPromptVersion(pv);
  }, [searchParams]);

  // ⚡ 逻辑：当 promptItems 加载完成且 URL 指定了版本时，自动填充 Prompt 内容
  useEffect(() => {
    if (promptItems.length > 0 && promptVersion) {
      const ver = normalizePromptVersion(promptVersion);
      const found = promptItems.find((p) => p.version === ver);
      if (found) {
        setSystemPrompt(found.content);
        // 如果 URL 没带参数，才用版本里的参数
        if (!searchParams.get("topK") && found.top_k) setTopKInput(String(found.top_k));
        if (!searchParams.get("threshold") && found.threshold) setThresholdInput(String(found.threshold));
      }
    }
  }, [promptItems, promptVersion, searchParams]);

  // 当选择版本时，自动填充参数和 Prompt
  function handleVersionSelect(v: string) {
    setPromptVersion(v);
    const ver = normalizePromptVersion(v);
    const found = promptItems.find((p) => p.version === ver);
    if (found) {
      setSystemPrompt(found.content);
      if (found.top_k) setTopKInput(String(found.top_k));
      if (found.threshold) setThresholdInput(String(found.threshold));
    }
  }

  async function saveAsStrategy() {
    const text = systemPrompt.trim();
    if (!text) {
      alert("请先输入 System Prompt 内容");
      return;
    }

    if (!confirm("确定要将当前实验参数保存为新的 Active 策略吗？这会立即影响所有 Ask 用户。")) {
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch("/api/prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "search_system",
          content: text,
          isActive: true,
          topK: normalizeTopK(topKInput),
          threshold: normalizeThreshold(thresholdInput),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err?.error || "保存失败");
      }

      alert("策略已发布并激活！");
    } catch (err) {
      alert(String((err as Error)?.message || err));
    } finally {
      setIsSaving(false);
    }
  }

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
      <div className="bg-white border-b px-6 py-4">
        <h1 className="font-bold text-xl">Search Lab</h1>
        <p className="text-xs text-gray-500 mt-1">
          调试检索质量、Prompt 版本与策略参数，验证后的配置可直接发布为正式策略。
        </p>
      </div>

      <section className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-4 p-4 flex-1 min-h-0">
        <div className="bg-white border rounded p-3 space-y-4 overflow-y-auto">
          <div className="space-y-3">
            <div className="text-sm font-bold border-b pb-2">1. 基础参数</div>
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
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={rewrite}
                  onChange={(e) => setRewrite(e.target.checked)}
                />
                rewrite
              </label>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={rerank}
                  onChange={(e) => setRerank(e.target.checked)}
                />
                rerank
              </label>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <div className="text-sm font-bold border-b pb-2">2. 策略 (Strategy)</div>
            <label className="block text-xs text-gray-600">
              选择已有版本进行对比
              <select
                value={promptVersion}
                onChange={(e) => handleVersionSelect(e.target.value)}
                className="mt-1 w-full border rounded px-2 py-1 text-sm bg-gray-50"
              >
                <option value="">-- 手动编辑 --</option>
                {promptItems.map((p) => (
                  <option key={p.id} value={p.version}>
                    v{p.version} {p.is_active ? "(Active)" : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs text-gray-600">
              System Prompt (系统指令)
              <textarea
                value={systemPrompt}
                onChange={(e) => {
                  setSystemPrompt(e.target.value);
                  setPromptVersion(""); // 手动修改后脱离版本绑定
                }}
                placeholder="在这里编写指令，例如：严禁编造..."
                className="mt-1 w-full h-48 border rounded px-2 py-1 text-[11px] font-mono leading-relaxed"
              />
            </label>
            <button
              disabled={isSaving}
              onClick={saveAsStrategy}
              className="w-full px-3 py-1.5 rounded border border-blue-600 text-blue-600 text-xs font-medium hover:bg-blue-50 disabled:opacity-50"
            >
              {isSaving ? "发布中..." : "将当前参数发布为新策略"}
            </button>
          </div>

          <div className="space-y-3 pt-2">
            <div className="text-sm font-bold border-b pb-2">3. 执行实验</div>
            <label className="block text-xs text-gray-600">
              测试问题
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="输入测试问题..."
                className="mt-1 w-full h-20 border rounded px-2 py-1 text-sm"
              />
            </label>
            <button
              disabled={isLoading}
              onClick={runExperiment}
              className="w-full px-3 py-2 rounded bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:bg-gray-400"
            >
              {isLoading ? "正在检索与生成..." : "运行实验"}
            </button>
          </div>
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

/**
 * ⚡ 最终导出：使用 Suspense 包裹，解决 Next.js 中 useSearchParams 导致的运行时错误
 */
export default function SearchLabPage(props: SearchLabPageProps) {
  return (
    <Suspense fallback={<div className="p-8 text-gray-500">正在准备实验环境...</div>}>
      <SearchLabContent {...props} />
    </Suspense>
  );
}
