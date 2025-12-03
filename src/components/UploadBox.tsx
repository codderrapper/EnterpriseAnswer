// src/components/UploadBox.tsx
"use client";

import { useRef, useState } from "react";

type UploadStatus = "pending" | "uploading" | "done" | "error";

type UploadItem = {
  id: string;
  file: File;
  status: UploadStatus;
  message?: string; // 成功 / 失败文案
};

interface Props {
  // 预留一个可选回调：以后我们做 /documents 页面时可以用它刷新列表
  onUploaded?: () => void;
}

export default function UploadBox({ onUploaded }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [items, setItems] = useState<UploadItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  // 🧠 用户选择文件时：把 FileList 转成队列项
  const handleSelectFiles = (files: FileList | null) => {
    if (!files?.length) return;

    const next: UploadItem[] = Array.from(files).map((file) => ({
      id: crypto.randomUUID(),
      file,
      status: "pending",
    }));

    setItems((prev) => [...prev, ...next]);

    // 选完就开始上传（单文件接口 → 逐个上传）
    void startUpload(next);
  };

  // 🚀 上传队列中的文件（串行，避免打爆后端；想并发以后可以再改）
  const startUpload = async (targets: UploadItem[]) => {
    setIsUploading(true);
    try {
      for (const item of targets) {
        // 标记为 uploading
        setItems((prev) =>
          prev.map((x) =>
            x.id === item.id
              ? { ...x, status: "uploading", message: undefined }
              : x
          )
        );

        const formData = new FormData();
        // ⚠️ 字段名 "file" 要与 /api/upload 的实现保持一致
        formData.append("file", item.file);

        try {
          const res = await fetch("/api/upload", {
            method: "POST",
            body: formData,
          });

          // 兼容你原来返回 JSON { filename, length, preview, error }
          const data = await res.json();

          if (!res.ok) {
            const msg = data?.error || `Upload failed: ${res.status}`;
            throw new Error(msg);
          }

          const successMsg = `✅ ${data.filename || item.file.name} · length ${
            data.length ?? "unknown"
          }`;

          setItems((prev) =>
            prev.map((x) =>
              x.id === item.id
                ? {
                    ...x,
                    status: "done",
                    message: successMsg,
                  }
                : x
            )
          );

          // 你原来是 console.log preview，这里保留
          if (data?.preview) {
            console.log("Extracted preview:", data.preview);
          }

          // 通知上层：有文件上传成功了（例如 /documents 页可用来刷新列表）
          onUploaded?.();
        } catch (err: any) {
          const errorMsg = `❌ ${
            err?.message || "Upload failed"
          }`;

          console.error("Upload error:", err);

          setItems((prev) =>
            prev.map((x) =>
              x.id === item.id
                ? {
                    ...x,
                    status: "error",
                    message: errorMsg,
                  }
                : x
            )
          );
        }
      }
    } finally {
      setIsUploading(false);
    }
  };

  const hasItems = items.length > 0;

  return (
    <div className="border-2 border-dashed border-gray-400 rounded-xl p-4 text-center bg-white">
      {/* 顶部：按钮区 */}
      <div className="flex items-center justify-between gap-3">
        <div className="text-left">
          <p className="font-semibold text-gray-700">
            📂 上传企业文档
          </p>
          <p className="text-xs text-gray-500 mt-1">
            支持多文件上传，PDF / Markdown / TXT。
          </p>
        </div>
        <div>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="px-3 py-1.5 rounded bg-blue-500 text-white text-xs hover:bg-blue-600"
          >
            {isUploading ? "上传中..." : "选择文件"}
          </button>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".pdf,.md,.markdown,.txt"
            className="hidden"
            onChange={(e) => handleSelectFiles(e.target.files)}
          />
        </div>
      </div>

      {/* 队列列表 */}
      {hasItems && (
        <div className="mt-3 max-h-40 overflow-y-auto text-xs text-left">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between py-1 border-t first:border-t-0"
            >
              <div className="flex-1 pr-2">
                <div className="truncate text-gray-800">
                  {item.file.name}
                </div>
                <div className="text-[11px] text-gray-500">
                  {(item.file.size / 1024).toFixed(1)} KB
                </div>
                {item.message && (
                  <div
                    className={`text-[11px] mt-0.5 ${
                      item.status === "error"
                        ? "text-red-500"
                        : "text-gray-600"
                    }`}
                  >
                    {item.message}
                  </div>
                )}
              </div>
              <StatusBadge status={item.status} />
            </div>
          ))}
        </div>
      )}

      {!hasItems && (
        <div className="mt-3 text-sm text-gray-500">
          还没有选择文件，点击右上角按钮添加。
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: UploadStatus }) {
  if (status === "pending") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] bg-gray-100 text-gray-600">
        待上传
      </span>
    );
  }
  if (status === "uploading") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] bg-blue-100 text-blue-700">
        上传中...
      </span>
    );
  }
  if (status === "done") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] bg-green-100 text-green-700">
        已完成
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] bg-red-100 text-red-700">
      失败
    </span>
  );
}
