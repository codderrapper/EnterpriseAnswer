import { describe, it, expect, beforeEach } from "vitest";
import {
  enforceSearchRateLimit,
  buildSearchCacheKey,
  getCachedSearchAnswer,
  setCachedSearchAnswer,
} from "../runtimeGuards";

describe("enforceSearchRateLimit", () => {
  // 每个测试用不同 workspaceId 避免状态污染
  let wsId: string;
  beforeEach(() => {
    wsId = `ws-${Math.random()}`;
  });

  it("正常请求应放行", () => {
    const result = enforceSearchRateLimit(wsId);
    expect(result.ok).toBe(true);
  });

  it("同一分钟超过限额应拒绝（RATE_LIMIT_MINUTE）", () => {
    const now = Date.now();
    // 默认限额 20/min，发 21 次
    for (let i = 0; i < 20; i++) {
      const r = enforceSearchRateLimit(wsId, now);
      expect(r.ok).toBe(true);
    }
    const rejected = enforceSearchRateLimit(wsId, now);
    expect(rejected.ok).toBe(false);
    if (!rejected.ok) {
      expect(rejected.errorCode).toBe("RATE_LIMIT_MINUTE");
    }
  });

  it("跨分钟后计数应重置", () => {
    const now = Date.now();
    const nextMinute = now + 60_000;
    for (let i = 0; i < 20; i++) {
      enforceSearchRateLimit(wsId, now);
    }
    // 下一分钟应该可以正常请求
    const result = enforceSearchRateLimit(wsId, nextMinute);
    expect(result.ok).toBe(true);
  });

  it("每日超过限额应拒绝（RATE_LIMIT_DAILY）", () => {
    // 分散在不同分钟，但同一天内
    const baseTime = new Date("2026-01-15T00:00:00Z").getTime();
    // 默认 100/day，每分钟发 1 次
    for (let i = 0; i < 100; i++) {
      const r = enforceSearchRateLimit(wsId, baseTime + i * 60_000);
      expect(r.ok).toBe(true);
    }
    const rejected = enforceSearchRateLimit(wsId, baseTime + 100 * 60_000);
    expect(rejected.ok).toBe(false);
    if (!rejected.ok) {
      expect(rejected.errorCode).toBe("RATE_LIMIT_DAILY");
    }
  });
});

describe("buildSearchCacheKey", () => {
  const base = {
    workspaceId: "ws-1",
    question: "什么是年假政策",
    topK: 5,
    threshold: 0.4,
    model: "gpt-4o-mini",
    promptVersion: null as number | null,
    rewrite: false,
    rerank: false,
  };

  it("相同参数应生成相同 key", () => {
    expect(buildSearchCacheKey(base)).toBe(buildSearchCacheKey({ ...base }));
  });

  it("不同参数应生成不同 key", () => {
    const key1 = buildSearchCacheKey(base);
    const key2 = buildSearchCacheKey({ ...base, topK: 10 });
    expect(key1).not.toBe(key2);
  });

  it("question 前后空格应被 trim", () => {
    const key1 = buildSearchCacheKey({ ...base, question: "  hello  " });
    const key2 = buildSearchCacheKey({ ...base, question: "hello" });
    expect(key1).toBe(key2);
  });

  it("threshold 应四舍五入到 3 位", () => {
    const key1 = buildSearchCacheKey({ ...base, threshold: 0.4000001 });
    const key2 = buildSearchCacheKey({ ...base, threshold: 0.4 });
    expect(key1).toBe(key2);
  });
});

describe("searchCache (get/set)", () => {
  it("set 后立刻 get 应命中", () => {
    const key = `test-hit-${Math.random()}`;
    const value = {
      answer: "回答内容",
      sources: [],
      model: "gpt-4o-mini",
      promptVersion: null,
    };
    setCachedSearchAnswer(key, value);
    expect(getCachedSearchAnswer(key)).toEqual(value);
  });

  it("未 set 的 key 应返回 null", () => {
    expect(getCachedSearchAnswer("nonexistent-key")).toBeNull();
  });

  it("过期后应返回 null", () => {
    const key = `test-ttl-${Math.random()}`;
    const value = {
      answer: "x",
      sources: [],
      model: "m",
      promptVersion: null,
    };
    // TTL 设为 1ms
    setCachedSearchAnswer(key, value, 1);

    // 用 vi.advanceTimersByTime 太重，直接手动等
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        expect(getCachedSearchAnswer(key)).toBeNull();
        resolve();
      }, 10);
    });
  });
});
