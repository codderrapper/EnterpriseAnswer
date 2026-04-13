// src/features/chat/store/chatRuntimeStore.ts
"use client";
import { create } from "zustand";

export const useChatRuntimeStore = create(() => ({
  content: "",
  requestId: null as string | null,
  status: "idle" as "idle" | "streaming" | "done" | "error",
  messages: [] as Array<{ id: string; role: "user" | "assistant"; content: string }>,
}));
