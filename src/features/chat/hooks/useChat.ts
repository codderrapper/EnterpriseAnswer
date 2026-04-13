"use client";
/**
 * Custom useChat hook for AI SDK v6.
 *
 * AI SDK v6 moved `useChat` to the separate `@ai-sdk/react` package (not
 * installed). This hook replicates the essential subset we need:
 *   - POST { messages } to /api/chat
 *   - Parse the UI-message-stream SSE response
 *   - Build text content from UIMessage parts for rendering
 *   - Forward data-route / data-evidence chunks to workflowRuntimeStore
 */

import { useCallback, useRef, useState } from "react";
import { generateId, uiMessageChunkSchema } from "ai";
import { parseJsonEventStream } from "@ai-sdk/provider-utils";
import type { UIMessageChunk } from "ai";
import { useWorkflowRuntimeStore } from "@/features/knowledge-workflow/store/workflowRuntimeStore";
import type { EvidenceItem } from "@/features/knowledge-workflow/store/workflowRuntimeStore";
import type { WorkflowRoute } from "@/features/knowledge-workflow/server/types";

/** Simplified message shape for rendering. */
export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface UseChatOptions {
  api?: string;
  onError?: (err: Error) => void;
}

interface UseChatReturn {
  messages: ChatMessage[];
  append: (message: { role: "user"; content: string }) => Promise<void>;
  isLoading: boolean;
}

export function useChat({ api = "/api/chat", onError }: UseChatOptions = {}): UseChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const workflowStore = useWorkflowRuntimeStore();

  // Keep a ref to the latest messages for building the API payload
  const messagesRef = useRef<ChatMessage[]>(messages);
  messagesRef.current = messages;

  const append = useCallback(
    async (userMsg: { role: "user"; content: string }) => {
      const userChatMsg: ChatMessage = {
        id: generateId(),
        role: "user",
        content: userMsg.content,
      };

      // Optimistically add user message
      const nextMessages = [...messagesRef.current, userChatMsg];
      setMessages(nextMessages);
      setIsLoading(true);

      const assistantId = generateId();

      try {
        const response = await fetch(api, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: nextMessages.map((m) => ({
              role: m.role,
              content: m.content,
            })),
          }),
        });

        if (!response.ok || !response.body) {
          throw new Error(`Chat API error: ${response.status} ${response.statusText}`);
        }

        // Add assistant message placeholder immediately so it appears in list
        setMessages((prev) => [
          ...prev,
          { id: assistantId, role: "assistant", content: "" },
        ]);

        // Parse the SSE JSON-event stream into UIMessageChunk objects
        const chunkStream = parseJsonEventStream({
          stream: response.body,
          schema: uiMessageChunkSchema,
        });

        // Track accumulated text for the assistant message
        let assistantText = "";
        // Track open text parts by id
        const openTextParts = new Map<string, string>();

        // Process each raw chunk for both text and data events
        const reader = chunkStream.getReader();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            if (!value.success) continue;
            const chunk: UIMessageChunk = value.value;

            switch (chunk.type) {
              case "text-start":
                openTextParts.set(chunk.id, "");
                break;
              case "text-delta": {
                const existing = openTextParts.get(chunk.id) ?? "";
                openTextParts.set(chunk.id, existing + chunk.delta);
                // Rebuild full assistant text from all open parts
                assistantText = Array.from(openTextParts.values()).join("");
                setMessages((prev) => {
                  const idx = prev.findIndex((m) => m.id === assistantId);
                  if (idx < 0) return prev;
                  const next = [...prev];
                  next[idx] = { ...next[idx], content: assistantText };
                  return next;
                });
                break;
              }
              case "text-end":
                // Part finalized — text already accumulated
                break;

              default: {
                // Handle data-* chunks for workflow store
                if (chunk.type.startsWith("data-")) {
                  const dataChunk = chunk as { type: string; data: unknown };
                  handleDataChunk(dataChunk.type, dataChunk.data, workflowStore);
                }
                break;
              }
            }
          }
        } finally {
          reader.releaseLock();
        }
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        onError?.(error);
        console.error("[useChat] error:", error);
        // Remove the empty assistant placeholder on error
        setMessages((prev) => prev.filter((m) => m.id !== assistantId || m.content !== ""));
      } finally {
        setIsLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [api, onError],
  );

  return { messages, append, isLoading };
}

type WorkflowStoreActions = {
  applyRouteEvent: (route: WorkflowRoute, reason: string) => void;
  applyEvidenceEvent: (stage: "retrieved" | "reranked" | "selected", documents: EvidenceItem[]) => void;
};

/**
 * Route data-* stream events to the workflowRuntimeStore.
 */
function handleDataChunk(
  type: string,
  data: unknown,
  store: WorkflowStoreActions,
): void {
  if (!data || typeof data !== "object") return;
  const d = data as Record<string, unknown>;

  if (type === "data-route") {
    const route = d.route as string | undefined;
    const reason = (d.reason as string | undefined) ?? "";
    if (route) {
      store.applyRouteEvent(route as WorkflowRoute, reason);
    }
  } else if (type === "data-evidence") {
    const stage = d.stage as "retrieved" | "reranked" | "selected" | undefined;
    const documents = d.documents as EvidenceItem[] | undefined;
    if (stage && Array.isArray(documents)) {
      store.applyEvidenceEvent(stage, documents);
    }
  }
}
