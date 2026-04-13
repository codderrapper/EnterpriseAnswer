// src/app/agent/components/AgentChat.tsx
// @deprecated This component uses the legacy useAgentStore pattern and should not
// evolve further. The canonical pattern is in src/features/chat/ (useChat hook +
// workflowRuntimeStore). New chat UI work should extend that instead.
"use client";

import { useAgentStore } from "@/store/agentStore";
import MarkdownRenderer from "@/components/MarkdownRenderer";

export default function AgentChat() {
  const { question, setQuestion, answer, isRunning, error, run } = useAgentStore();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    run();
  };

  return (
    <div className="flex flex-col h-full">
      {/* 输入区 */}
      <form onSubmit={handleSubmit} className="p-4 border-b border-gray-800">
        <div className="flex gap-2">
          <input
            type="text"
            value={question}
            onChange={e => setQuestion(e.target.value)}
            placeholder="输入问题..."
            disabled={isRunning}
            className="flex-1 bg-gray-800 text-white rounded px-3 py-2 text-sm border border-gray-700 focus:border-blue-500 focus:outline-none disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isRunning || !question.trim()}
            className="bg-blue-600 text-white rounded px-4 py-2 text-sm font-medium hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isRunning ? "运行中..." : "发送"}
          </button>
        </div>
      </form>

      {/* 回答区 */}
      <div className="flex-1 overflow-auto p-4">
        {error && (
          <div className="text-red-400 text-sm bg-red-900/20 rounded p-3 mb-3">
            {error}
          </div>
        )}
        {answer && (
          <div className="text-gray-200 text-sm leading-relaxed">
            <MarkdownRenderer content={answer} />
          </div>
        )}
        {isRunning && !answer && (
          <div className="text-gray-500 text-sm animate-pulse">正在检索和生成...</div>
        )}
        {!isRunning && !answer && !error && (
          <div className="text-gray-600 text-sm">在左侧可以看到 CRAG Graph 的实时执行过程</div>
        )}
      </div>
    </div>
  );
}
