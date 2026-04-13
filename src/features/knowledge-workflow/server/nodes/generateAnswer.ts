import type { WorkflowState } from "../state";
import { getAIClient, AI_MODEL } from "@/lib/ai-client";
import type { RunnableConfig } from "@langchain/core/runnables";
import type { WorkflowEvent } from "../events";

const SYSTEM_PROMPT = `你是企业知识库助手。请根据以下文档内容回答用户问题。
要求：
- 只使用文档中的信息，不要凭空推测
- 回答简洁、准确
- 如果文档内容不足以完整回答，请说明`;

export async function generateAnswer(
  state: WorkflowState,
  config?: RunnableConfig,
): Promise<Partial<WorkflowState>> {
  const send = config?.configurable?.send as ((e: WorkflowEvent) => void) | undefined;
  const requestId = config?.configurable?.requestId as string ?? "";

  send?.({ type: "data-node", ts: Date.now(), requestId, data: { node: "generateAnswer", status: "running", ts: Date.now(), requestId } });

  const evidence =
    state.selectedEvidence.length > 0
      ? state.selectedEvidence
      : state.rerankedDocs.length > 0
        ? state.rerankedDocs
        : state.retrievedDocs;

  if (evidence.length === 0) {
    send?.({ type: "data-node", ts: Date.now(), requestId, data: { node: "generateAnswer", status: "completed", ts: Date.now(), requestId } });
    return { answerDraft: "" };
  }

  const context = evidence.map((d) => d.content).join("\n---\n");
  const systemContent = `${SYSTEM_PROMPT}\n\n【文档内容】\n${context}`;

  const client = getAIClient();
  const completion = await client.chat.completions.create({
    model: AI_MODEL,
    messages: [
      { role: "system", content: systemContent },
      { role: "user", content: state.userQuestion },
    ],
    temperature: 0.3,
  });

  const answer = completion.choices[0]?.message?.content ?? "";
  send?.({ type: "data-node", ts: Date.now(), requestId, data: { node: "generateAnswer", status: "completed", ts: Date.now(), requestId } });
  return { answerDraft: answer };
}
