import { describe, it, expect } from "vitest";
import { splitText } from "../textChunker";

describe("splitText", () => {
  it("空字符串应返回空数组", () => {
    expect(splitText("")).toEqual([]);
  });

  it("短于 chunkSize 的文本应返回单个片段", () => {
    const result = splitText("hello", 500, 50);
    expect(result).toEqual(["hello"]);
  });

  it("应按 chunkSize 切分并带 overlap", () => {
    // 10 字符切片，2 字符重叠 → 步长 8
    const text = "0123456789abcdefghij"; // 20 字符
    const result = splitText(text, 10, 2);

    // 步长 8: [0..10], [8..18], [16..20]
    expect(result).toHaveLength(3);
    expect(result[0]).toBe("0123456789");
    expect(result[1]).toBe("89abcdefgh");
    expect(result[2]).toBe("ghij");
  });

  it("相邻片段应有重叠内容", () => {
    const text = "a".repeat(1000);
    const chunks = splitText(text, 500, 50);

    // 第一段结尾 50 字符 === 第二段开头 50 字符
    const tail = chunks[0].slice(-50);
    const head = chunks[1].slice(0, 50);
    expect(tail).toBe(head);
  });

  it("使用默认参数（chunkSize=500, overlap=50）", () => {
    const text = "x".repeat(1200);
    const chunks = splitText(text);

    // 步长 450: ceil(1200/450) = 3 个片段
    expect(chunks).toHaveLength(3);
    expect(chunks[0]).toHaveLength(500);
    expect(chunks[1]).toHaveLength(500);
  });

  it("overlap=0 时不应有重叠", () => {
    const text = "abcdefghij"; // 10 字符
    const result = splitText(text, 5, 0);
    expect(result).toEqual(["abcde", "fghij"]);
  });
});
