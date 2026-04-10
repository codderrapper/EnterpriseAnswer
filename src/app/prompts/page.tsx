"use client";

import useSWR from "swr";
import { FormEvent, useState } from "react";

type PromptItem = {
  id: number;
  name: string;
  version: number;
  content: string;
  is_active: boolean;
  created_at: string;
};

type PromptResp = {
  items: PromptItem[];
};

const fetcher = async (url: string) => {
  const res = await fetch(url);

  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.error || `请求失败 ${res.status}`);
  }

  return res.json() as Promise<PromptResp>;
};

export default function PromptsPage() {
  const { data, error, mutate, isLoading } = useSWR<PromptResp>(
    "/api/prompts?name=search_system",
    fetcher,
  );
  const [content, setContent] = useState("");
  const [creating, setCreating] = useState(false);

  const items = data?.items ?? [];

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    const text = content.trim();
    if (!text) return;

    setCreating(true);
    try {
      const res = await fetch("/api/prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "search_system",
          content: text,
          isActive: true,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err?.error || "创建失败");
      }
      setContent("");
      await mutate();
    } catch (err) {
      alert(String((err as Error)?.message || err));
    } finally {
      setCreating(false);
    }
  }

  async function activate(id: number) {
    try {
      const res = await fetch("/api/prompts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, activate: true }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err?.error || "激活失败");
      }
      await mutate();
    } catch (err) {
      alert(String((err as Error)?.message || err));
    }
  }

  return (
    <main className="min-h-screen w-full flex flex-col bg-gray-100 text-gray-900">
      <header className="space-y-3 border-b bg-white p-4">
        <div>
          <h1 className="font-bold text-xl">Strategy</h1>
          <p className="text-xs text-gray-500 mt-1">
            管理问答系统策略版本，用于发布、激活与回滚检索回答策略
          </p>
        </div>
      </header>

      <section className="p-4 space-y-4 overflow-y-auto">
        <form onSubmit={onCreate} className="bg-white border rounded p-3 space-y-2">
          <label htmlFor="prompt-content" className="block text-sm font-medium">
            发布新策略版本（自动置为 active）
          </label>
          <textarea
            id="prompt-content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="输入新的系统策略内容"
            className="w-full h-40 border rounded p-2 text-sm"
          />
          <button
            disabled={creating}
            className="px-3 py-1.5 rounded text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400"
          >
            {creating ? "提交中..." : "发布新版本"}
          </button>
        </form>

        {error && (
          <div className="text-red-500 text-sm">
            加载失败：{error instanceof Error ? error.message : String(error)}
          </div>
        )}

        <div className="bg-white border rounded overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left border-b w-24">版本</th>
                <th className="px-3 py-2 text-left border-b">内容预览</th>
                <th className="px-3 py-2 text-left border-b w-44">创建时间</th>
                <th className="px-3 py-2 text-left border-b w-24">状态</th>
                <th className="px-3 py-2 text-left border-b w-24">操作</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td className="px-3 py-3 text-gray-500" colSpan={5}>
                    加载中...
                  </td>
                </tr>
              )}
              {!isLoading && !error && items.length === 0 && (
                <tr>
                  <td className="px-3 py-3 text-gray-500" colSpan={5}>
                    暂无策略版本
                  </td>
                </tr>
              )}
              {items.map((item) => (
                <tr key={item.id} className="border-b last:border-b-0 align-top">
                  <td className="px-3 py-2">v{item.version}</td>
                  <td className="px-3 py-2">
                    <pre className="whitespace-pre-wrap text-xs text-gray-700 line-clamp-4">{item.content}</pre>
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-600">
                    {new Date(item.created_at).toLocaleString()}
                  </td>
                  <td className="px-3 py-2">
                    {item.is_active ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200">
                        active
                      </span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-200">
                        archived
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {!item.is_active ? (
                      <button
                        className="text-blue-600 hover:underline"
                        onClick={() => activate(item.id)}
                      >
                        激活
                      </button>
                    ) : (
                      <span className="text-xs text-gray-500">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
