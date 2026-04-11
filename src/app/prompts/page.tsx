"use client";

import useSWR from "swr";
import Link from "next/link";

type PromptItem = {
  id: number;
  name: string;
  version: number;
  content: string;
  is_active: boolean;
  created_at: string;
  top_k: number | null;
  threshold: number | null;
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

  const items = data?.items ?? [];

  async function activate(id: number) {
    if (!confirm("确定要激活此版本吗？这会立即影响所有 Ask 用户。")) return;

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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-bold text-xl">Strategy</h1>
            <p className="text-xs text-gray-500 mt-1">
              管理问答系统策略版本。请前往 <b>Search Lab</b> 调试并发布新版本。
            </p>
          </div>
          <Link
            href="/debug/search"
            className="px-3 py-1.5 rounded bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
          >
            去实验室调优
          </Link>
        </div>
      </header>

      <section className="p-4 space-y-4 overflow-y-auto">
        {error && (
          <div className="text-red-500 text-sm">
            加载失败：{error instanceof Error ? error.message : String(error)}
          </div>
        )}

        <div className="bg-white border rounded overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="px-4 py-3 text-left border-b w-20">版本</th>
                <th className="px-4 py-3 text-left border-b w-32">参数快照</th>
                <th className="px-4 py-3 text-left border-b">System Prompt 预览</th>
                <th className="px-4 py-3 text-left border-b w-44">创建时间</th>
                <th className="px-4 py-3 text-left border-b w-24">状态</th>
                <th className="px-4 py-3 text-center border-b w-32">操作</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td className="px-4 py-8 text-center text-gray-500" colSpan={6}>
                    正在加载策略库...
                  </td>
                </tr>
              )}
              {!isLoading && !error && items.length === 0 && (
                <tr>
                  <td className="px-4 py-8 text-center text-gray-500" colSpan={6}>
                    暂无策略版本，请先去实验室发布一个。
                  </td>
                </tr>
              )}
              {items.map((item) => (
                <tr key={item.id} className="border-b last:border-b-0 align-top hover:bg-gray-50/50">
                  <td className="px-4 py-3 font-medium text-gray-900">v{item.version}</td>
                  <td className="px-4 py-3 text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="text-gray-500">TopK:</span>
                      <span className="font-mono">{item.top_k ?? "-"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Threshold:</span>
                      <span className="font-mono">{item.threshold?.toFixed(2) ?? "-"}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <pre className="whitespace-pre-wrap text-xs text-gray-600 line-clamp-3 bg-gray-50 p-2 rounded border border-gray-100">
                      {item.content}
                    </pre>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {new Date(item.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    {item.is_active ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-[11px] font-bold border border-green-200">
                        ACTIVE
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 text-[11px] font-medium border border-gray-200">
                        ARCHIVED
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center space-y-2">
                    {!item.is_active && (
                      <button
                        className="block w-full text-xs text-blue-600 hover:text-blue-800 font-medium"
                        onClick={() => activate(item.id)}
                      >
                        激活上线
                      </button>
                    )}
                    <Link
                      href={`/debug/search?promptVersion=${item.version}`}
                      className="block w-full text-xs text-emerald-600 hover:text-emerald-800 font-medium"
                    >
                      以此版本调试
                    </Link>
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
