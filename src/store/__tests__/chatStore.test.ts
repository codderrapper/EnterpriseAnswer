import { describe, it, expect, beforeEach } from "vitest";
import { useChatStore } from "../chatStore";

describe("chatStore — setTopK", () => {
  beforeEach(() => {
    useChatStore.setState({ topK: 5 });
  });

  it("正常值应直接设置", () => {
    useChatStore.getState().setTopK(10);
    expect(useChatStore.getState().topK).toBe(10);
  });

  it("负数应回退到默认值 5", () => {
    useChatStore.getState().setTopK(-1);
    expect(useChatStore.getState().topK).toBe(5);
  });

  it("0 应回退到默认值 5", () => {
    useChatStore.getState().setTopK(0);
    expect(useChatStore.getState().topK).toBe(5);
  });

  it("超过 20 应被截断为 20", () => {
    useChatStore.getState().setTopK(99);
    expect(useChatStore.getState().topK).toBe(20);
  });

  it("小数应被 floor", () => {
    useChatStore.getState().setTopK(7.8);
    expect(useChatStore.getState().topK).toBe(7);
  });

  it("NaN 应回退到默认值 5", () => {
    useChatStore.getState().setTopK(NaN);
    expect(useChatStore.getState().topK).toBe(5);
  });
});

describe("chatStore — setThreshold", () => {
  beforeEach(() => {
    useChatStore.setState({ threshold: 0.4 });
  });

  it("正常值应直接设置", () => {
    useChatStore.getState().setThreshold(0.7);
    expect(useChatStore.getState().threshold).toBe(0.7);
  });

  it("负数应回退到默认值 0.4", () => {
    useChatStore.getState().setThreshold(-0.5);
    expect(useChatStore.getState().threshold).toBe(0.4);
  });

  it("大于 1 应回退到默认值 0.4", () => {
    useChatStore.getState().setThreshold(2);
    expect(useChatStore.getState().threshold).toBe(0.4);
  });

  it("边界值 0 应被接受", () => {
    useChatStore.getState().setThreshold(0);
    expect(useChatStore.getState().threshold).toBe(0);
  });

  it("边界值 1 应被接受", () => {
    useChatStore.getState().setThreshold(1);
    expect(useChatStore.getState().threshold).toBe(1);
  });
});
