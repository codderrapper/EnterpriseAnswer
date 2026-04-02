const minuteCounter = new Map<string, number>();
const dayCounter = new Map<string, number>();

const searchCache = new Map<string, { expiresAt: number; value: CachedAnswer }>();

export type CachedAnswer = {
  answer: string;
  sources: Array<{ id: number; document_id: number; content: string; similarity?: number }>;
  model: string;
  promptVersion: number | null;
};

const PER_MINUTE_LIMIT = Number(process.env.SEARCH_LIMIT_PER_MINUTE ?? 20);
const PER_DAY_LIMIT = Number(process.env.SEARCH_LIMIT_PER_DAY ?? 100);

function dayKey(now: Date) {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function enforceSearchRateLimit(workspaceId: string, nowMs = Date.now()) {
  const now = new Date(nowMs);
  const minute = Math.floor(nowMs / 60_000);

  const minuteK = `${workspaceId}:${minute}`;
  const dayK = `${workspaceId}:${dayKey(now)}`;

  const minuteCount = (minuteCounter.get(minuteK) ?? 0) + 1;
  const dailyCount = (dayCounter.get(dayK) ?? 0) + 1;

  minuteCounter.set(minuteK, minuteCount);
  dayCounter.set(dayK, dailyCount);

  if (minuteCount > PER_MINUTE_LIMIT) {
    return {
      ok: false as const,
      errorCode: "RATE_LIMIT_MINUTE",
      message: `请求过于频繁：每分钟最多 ${PER_MINUTE_LIMIT} 次`,
    };
  }

  if (dailyCount > PER_DAY_LIMIT) {
    return {
      ok: false as const,
      errorCode: "RATE_LIMIT_DAILY",
      message: `请求配额已用尽：每天最多 ${PER_DAY_LIMIT} 次`,
    };
  }

  return { ok: true as const };
}

export function buildSearchCacheKey(input: {
  workspaceId: string;
  question: string;
  topK: number;
  threshold: number;
  model: string;
  promptVersion: number | null;
  rewrite: boolean;
  rerank: boolean;
}) {
  return JSON.stringify({
    w: input.workspaceId,
    q: input.question.trim(),
    k: input.topK,
    t: Number(input.threshold.toFixed(3)),
    m: input.model,
    p: input.promptVersion,
    rw: input.rewrite,
    rr: input.rerank,
  });
}

export function getCachedSearchAnswer(cacheKey: string) {
  const item = searchCache.get(cacheKey);
  if (!item) return null;
  if (Date.now() >= item.expiresAt) {
    searchCache.delete(cacheKey);
    return null;
  }
  return item.value;
}

export function setCachedSearchAnswer(
  cacheKey: string,
  value: CachedAnswer,
  ttlMs = 60_000,
) {
  searchCache.set(cacheKey, {
    value,
    expiresAt: Date.now() + ttlMs,
  });
}
