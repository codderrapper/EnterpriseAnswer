"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeHighlight from "rehype-highlight";
import rehypeKatex from "rehype-katex";

import "highlight.js/styles/github.css";
import "katex/dist/katex.min.css";

interface Props {
  content: string;
}

/** 🧠 工具1：去除最外层 ```markdown 包裹 */
function unwrapTopFence(md: string) {
  if (!md) return md.trim();

  // 匹配最外层围栏 ``` 或 ~~~
  const fenceRegex = /^(?:\s*)(```|~~~)[^\n]*\n([\s\S]*?)\n\1(?:\s*)$/;
  const match = md.match(fenceRegex);
  return match ? match[2].trim() : md.trim();
}

/** 🧩 工具2：容错修正任务列表（[ ] 开头也能识别） */
function normalizeTasks(md: string) {
  return md.replace(
    /^\s*\[\s*([xX]?)\s*\]\s+(.*)$/gm,
    (_, x, text) => `- [${x ? "x" : " "}] ${text}`
  );
}

/** ✨ 主组件：Markdown 渲染器 */
export default function MarkdownRenderer({ content }: Props) {
  // 1️⃣ 清洗 Markdown 内容
  const cleaned = normalizeTasks(unwrapTopFence(content));

  return (
    <div
      className="prose prose-slate max-w-none leading-relaxed
      prose-headings:font-semibold
      prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg
      prose-img:rounded-lg prose-img:border prose-img:border-gray-200
      prose-a:text-blue-600 hover:prose-a:underline"
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeHighlight, rehypeKatex]}
        components={{
          // 🔗 链接
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),

          // 🖼️ 图片
          img: ({ src, alt }) => {
            // 🚫 拦截无效/相对路径，避免 Next.js 误请求
            if (!src || !/^https?:\/\//.test(src)) {
              return (
                <div className="my-3 text-gray-400 text-sm italic text-center">
                  [图片加载失败：无效链接]
                </div>
              );
            }
            return (
              <img
                src={src}
                alt={alt ?? ""}
                loading="lazy"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
                className="max-w-full mx-auto my-3 rounded-md border"
              />
            );
          },

          // 💬 引用块
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-blue-500 bg-blue-50 px-4 py-2 rounded-md text-gray-700 my-4">
              {children}
            </blockquote>
          ),

          // 💻 代码与代码块
          code: ({ inline, children }) =>
            inline ? (
              <code className="bg-gray-100 text-red-600 px-1 py-0.5 rounded">
                {children}
              </code>
            ) : (
              <pre className="bg-gray-900 text-gray-100 p-3 rounded-lg overflow-auto text-sm my-2">
                <code>{children}</code>
              </pre>
            ),

          // 🧾 表格
          table: ({ children }) => (
            <div className="overflow-x-auto my-2">
              <table className="w-full border border-gray-300 text-sm">
                {children}
              </table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border border-gray-300 bg-gray-100 px-3 py-2 text-left font-semibold">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border border-gray-200 px-3 py-2 align-top">
              {children}
            </td>
          ),

          // 📑 标题层级
          h1: ({ children }) => (
            <h1 className="text-2xl font-bold mt-4 mb-2 border-b pb-1">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-xl font-semibold mt-3 mb-1 text-blue-700">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-lg font-semibold mt-2 mb-1">{children}</h3>
          ),

          // 📋 列表
          ul: ({ children }) => (
            <ul className="list-disc pl-6 space-y-1 text-gray-800">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal pl-6 space-y-1 text-gray-800">
              {children}
            </ol>
          ),
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,

          // 🔤 段落
          p: ({ children }) => <p className="my-2 text-gray-800">{children}</p>,

          // ➖ 分割线
          hr: () => <hr className="my-4 border-gray-300" />,
        }}
      >
        {cleaned}
      </ReactMarkdown>
    </div>
  );
}
