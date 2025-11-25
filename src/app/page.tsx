"use client";

import { useState, useEffect, useRef, useLayoutEffect } from "react";
import MarkdownRenderer from "@/components/MarkdownRenderer";
import UploadBox from "@/components/UploadBox";

type Source = {
  id: number;
  document_id: number;
  snippet: string;
  similarity: string;
};

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
};

export default function Home() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setLoading] = useState(false);
  const chatBoxRef = useRef<HTMLDivElement | null>(null);

  // 💾 从本地恢复历史
  useEffect(() => {
    const saved = localStorage.getItem("chat_history_v2");
    if (saved) setMessages(JSON.parse(saved));
  }, []);

  // 💾 自动保存
  useEffect(() => {
    if (messages.length > 0)
      localStorage.setItem("chat_history_v2", JSON.stringify(messages));
  }, [messages]);

  // 🧭 每次消息变化后自动滚到底
  useLayoutEffect(() => {
    const el = chatBoxRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    });
  }, [messages]);

  // 🚀 发送提问
  async function handleSend() {
    if (!input.trim()) return;
    const userInput = input.trim();
    setInput("");
    setLoading(true);

    // Add user + empty assistant messages
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: "user", content: userInput },
      { id: crypto.randomUUID(), role: "assistant", content: "" },
    ]);

    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: userInput }),
      });

      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let aiResponse = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        aiResponse += chunk;

        setMessages((prev) => {
          const copy = [...prev];
          const last = copy[copy.length - 1];
          if (last.role === "assistant") last.content = aiResponse;
          return copy;
        });

        // keep scroll near bottom
        if (chatBoxRef.current) {
          const el = chatBoxRef.current;
          if (el.scrollHeight - el.scrollTop - el.clientHeight < 120) {
            el.scrollTop = el.scrollHeight;
          }
        }
      }
    } catch (err) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "❌ 出错啦，请稍后重试。",
        },
      ]);
    }

    setLoading(false);
  }
  // async function handleSend() {
  //   if (!input.trim()) return;
  //   const userInput = input.trim();
  //   setInput("");
  //   setLoading(true);

  //   // 用户输入
  //   setMessages((prev) => [
  //     ...prev,
  //     { id: crypto.randomUUID(), role: "user", content: userInput },
  //     { id: crypto.randomUUID(), role: "assistant", content: "" },
  //   ]);

  //   try {
  //     const res = await fetch("/api/search", {
  //       method: "POST",
  //       headers: { "Content-Type": "application/json" },
  //       body: JSON.stringify({ question: userInput }),
  //     });

  //     const data = await res.json();

  //     setMessages((prev) => {
  //       const copy = [...prev];
  //       const last = copy[copy.length - 1];
  //       if (last.role === "assistant") {
  //         last.content = data.answer || "No answer.";
  //         last.sources = data.sources || [];
  //       }
  //       return copy;
  //     });
  //   } catch (err) {
  //     console.error(err);
  //     setMessages((prev) => [
  //       ...prev,
  //       {
  //         id: crypto.randomUUID(),
  //         role: "assistant",
  //         content: "❌ 出错啦，请稍后重试。",
  //       },
  //     ]);
  //   }

  //   setLoading(false);
  // }

  // 🧱 渲染单条消息
  function ChatMessage({ msg }: { msg: Message }) {
    const isAI = msg.role === "assistant";
    return (
      <div
        className={`max-w-[85%] rounded-lg p-3 ${
          isAI
            ? "bg-white text-gray-900 self-start shadow-sm border"
            : "bg-blue-500 text-white self-end ml-auto"
        }`}
      >
        <MarkdownRenderer content={msg.content} />
        {/* 显示来源 */}
        {isAI && msg.sources && msg.sources.length > 0 && (
          <div className="mt-2 text-xs text-gray-600 border-t pt-1">
            <strong>来源：</strong>
            {msg.sources.map((s, i) => (
              <div key={s.id} className="truncate">
                📄 {s.snippet}（相似度 {s.similarity}）
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <main className="h-[100dvh] max-w-2xl mx-auto flex flex-col bg-gray-100 text-gray-900 border-x">
      {/* 顶部标题 */}
      <header className="p-4 border-b bg-white text-center font-bold text-xl">
        企业文档智能助手
      </header>

      {/* 上传组件 */}
      <div className="p-4">
        <UploadBox />
      </div>

      {/* 聊天内容区 */}
      <section
        ref={chatBoxRef}
        className="flex-1 overflow-y-auto bg-gray-50 p-4 space-y-3 scroll-smooth"
      >
        {messages.map((m) => (
          <ChatMessage key={m.id} msg={m} />
        ))}
      </section>

      {isLoading && (
        <div className="self-start text-gray-500 text-sm animate-pulse px-3">
          🤖 AI 正在思考中…
        </div>
      )}
      {/* 底部输入区 */}
      <footer className="p-4 border-t bg-white flex gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !isLoading) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="请输入问题..."
          disabled={isLoading}
          className="flex-1 border rounded p-2 resize-none overflow-hidden focus:outline-none focus:ring-2 focus:ring-blue-400"
          style={{ minHeight: "40px", maxHeight: "200px" }}
        />
        <button
          onClick={handleSend}
          disabled={isLoading}
          className={`px-4 py-2 rounded text-white ${
            isLoading ? "bg-gray-400" : "bg-blue-500 hover:bg-blue-600"
          }`}
        >
          {isLoading ? "思考中..." : "发送"}
        </button>
      </footer>
    </main>
  );
}
