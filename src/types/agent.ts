// src/types/agent.ts

// ⚙️ 智能体执行步骤的状态
// 面试点：有限状态机 / 状态枚举
export type StepStatus = "pending" | "running" | "done" | "error";

// 🧠 智能体执行过程中的每一步（前端可视化用）
export type AgentStep = {
  id: string;          // 唯一标识（如 embed / retrieve / tool / llm）
  title: string;       // 展示文案，例如 "生成查询向量"
  status: StepStatus;  // 当前状态
  detail?: string;     // 可选的补充信息，例如 "命中 5 条片段"
};
