/**
 * 将长文本拆分为固定大小、带重叠的片段。
 */
export function splitText(
  text: string,
  chunkSize = 500,
  overlap = 50,
): string[] {
  if (!text) return [];
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += chunkSize - overlap) {
    chunks.push(text.slice(i, i + chunkSize));
  }
  return chunks;
}
