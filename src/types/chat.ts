// src/types/chat.ts

// 🧩 RAG 来源片段，前后端会共享这部分结构
export type Source = {
  id: number;
  document_id: number;
  snippet: string;
  similarity: string;
};

// 💬 单条消息：用于前端渲染和多轮对话 history 透传给后端
export type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
};
