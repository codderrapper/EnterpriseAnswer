import { create } from "zustand";

export const useChatRuntimeStore = create(() => ({
  content: "",
}));
