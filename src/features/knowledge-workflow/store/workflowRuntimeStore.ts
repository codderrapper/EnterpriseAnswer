import { create } from "zustand";

export const useWorkflowRuntimeStore = create(() => ({
  route: null as string | null,
  events: [] as unknown[],
}));
