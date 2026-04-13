"use client";
import { useWorkflowRuntimeStore } from "@/features/knowledge-workflow/store/workflowRuntimeStore";

export default function EvidencePanel() {
  const { retrievedDocs, selectedDocs } = useWorkflowRuntimeStore();
  const docs = selectedDocs.length > 0 ? selectedDocs : retrievedDocs;

  if (docs.length === 0) return (
    <div className="text-sm italic text-slate-400 p-4">暂无详情</div>
  );

  return (
    <div className="space-y-2 p-3 overflow-y-auto">
      {docs.map((doc) => (
        <div key={doc.id} className="rounded border border-slate-200 bg-white p-2 text-xs">
          <div className="text-slate-500 mb-1">
            {doc.similarity != null && `相似度 ${doc.similarity.toFixed(2)}`}
            {doc.relevance && ` · ${doc.relevance}`}
          </div>
          <div className="text-slate-700 line-clamp-3">{doc.content}</div>
        </div>
      ))}
    </div>
  );
}
