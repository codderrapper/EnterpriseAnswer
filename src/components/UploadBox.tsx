"use client";

import { useState } from "react";

export default function UploadBox() {
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState("");

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setStatus("Uploading...");

    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/upload", {
      method: "POST",
      body: formData,
    });

    const data = await res.json();
    setUploading(false);

    if (!res.ok) {
      setStatus(`❌ ${data.error || "Upload failed"}`);
    } else {
      setStatus(`✅ Uploaded: ${data.filename}, length ${data.length}`);
      console.log("Extracted preview:", data.preview);
    }
  }

  return (
    <div className="border-2 border-dashed border-gray-400 rounded-xl p-6 text-center bg-white">
      <input
        type="file"
        accept=".pdf,.md,.markdown,.txt"
        onChange={handleUpload}
        className="hidden"
        id="fileInput"
      />
      <label htmlFor="fileInput" className="cursor-pointer">
        {uploading ? (
          <p className="text-blue-600 font-semibold">Uploading...</p>
        ) : (
          <div>
            <p className="font-semibold text-gray-700">📂 Click to upload file</p>
            <p className="text-sm text-gray-500 mt-1">PDF, Markdown, or TXT</p>
          </div>
        )}
      </label>

      {status && <p className="mt-3 text-sm text-gray-600">{status}</p>}
    </div>
  );
}
