"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import MetricCard from "@/app/dashboard/components/MetricCard";

type DocumentListItem = {
  id: number;
  name: string;
  created_at: string;
  content_preview: string;
  chunk_count: number;
};

type RunListItem = {
  id: number;
  question: string;
  answer: string | null;
  error_code: string | null;
  matched_count: number | null;
  duration_ms: number | null;
  created_at: string;
};

type DashboardData = {
  documents: {
    items: DocumentListItem[];
    total: number;
  };
  chunkTotal: number;
  runs: {
    items: RunListItem[];
    total: number;
  };
  hasDataError: boolean;
  isLoading: boolean;
};

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function getRunStatus(run: RunListItem) {
  if (run.error_code) {
    return { label: run.error_code, tone: "error" as const };
  }

  return { label: "Healthy", tone: "success" as const };
}

export default function HomePage() {
  const [data, setData] = useState<DashboardData>({
    documents: { items: [], total: 0 },
    chunkTotal: 0,
    runs: { items: [], total: 0 },
    hasDataError: false,
    isLoading: true,
  });

  useEffect(() => {
    const controller = new AbortController();

    async function loadDashboardData() {
      try {
        const [documentsResult, runsResult] = await Promise.allSettled([
          fetch("/api/documents?page=1&pageSize=6", {
            cache: "no-store",
            signal: controller.signal,
          }),
          fetch("/api/runs?page=1&pageSize=6", {
            cache: "no-store",
            signal: controller.signal,
          }),
        ]);

        let documents: DashboardData["documents"] = {
          items: [],
          total: 0,
        };
        let chunkTotal = 0;
        let runs: DashboardData["runs"] = { items: [], total: 0 };
        let hasDataError = false;

        if (documentsResult.status === "fulfilled" && documentsResult.value.ok) {
          documents = (await documentsResult.value.json()) as DashboardData["documents"];

          if (documents.total > 0) {
            const allDocumentsResult = await fetch(
              `/api/documents?page=1&pageSize=${documents.total}`,
              {
                cache: "no-store",
                signal: controller.signal,
              },
            );

            if (allDocumentsResult.ok) {
              const allDocuments = (await allDocumentsResult.json()) as DashboardData["documents"];
              chunkTotal = allDocuments.items.reduce(
                (sum, doc) => sum + (doc.chunk_count ?? 0),
                0,
              );
            } else {
              hasDataError = true;
              chunkTotal = documents.items.reduce(
                (sum, doc) => sum + (doc.chunk_count ?? 0),
                0,
              );
            }
          }
        } else {
          hasDataError = true;
        }

        if (runsResult.status === "fulfilled" && runsResult.value.ok) {
          runs = (await runsResult.value.json()) as DashboardData["runs"];
        } else {
          hasDataError = true;
        }

        setData({
          documents,
          chunkTotal,
          runs,
          hasDataError,
          isLoading: false,
        });
      } catch (error) {
        if ((error as DOMException).name === "AbortError") {
          return;
        }

        setData((current) => ({
          ...current,
          hasDataError: true,
          isLoading: false,
        }));
      }
    }

    loadDashboardData();

    return () => controller.abort();
  }, []);

  const totalChunks = data.documents.items.reduce(
    (sum, doc) => sum + (doc.chunk_count ?? 0),
    0,
  );

  const metrics = [
    {
      label: "Documents",
      value: data.isLoading ? "—" : formatNumber(data.documents.total),
      detail: "Ingested knowledge assets",
    },
    {
      label: "Chunks",
      value: data.isLoading ? "—" : formatNumber(data.chunkTotal || totalChunks),
      detail: "Indexed passages available for retrieval",
    },
    {
      label: "Runs",
      value: data.isLoading ? "—" : formatNumber(data.runs.total),
      detail: "Observed question-answer executions",
    },
    {
      label: "Feedback",
      value: "0",
      detail: "Phase 1 placeholder, ready for activation",
    },
  ];

  const quickLinks = [
    {
      href: "/ask",
      label: "Ask",
      description: "Enter the stable enterprise Q&A workspace.",
    },
    {
      href: "/documents",
      label: "Documents",
      description: "Review knowledge ingestion and document health.",
    },
    {
      href: "/runs",
      label: "Runs",
      description: "Inspect execution history and retrieval behavior.",
    },
    {
      href: "/prompts",
      label: "Strategy",
      description: "Manage the system prompt and product strategy.",
    },
  ];

  return (
    <main className="min-h-full bg-[radial-gradient(circle_at_top_left,_rgba(15,23,42,0.08),_transparent_35%),linear-gradient(180deg,#f8fafc_0%,#eef2f7_100%)] text-slate-900">
      <div className="flex w-full flex-col px-6 py-6 lg:px-8">
        <header className="rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-sm backdrop-blur">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-3xl space-y-3">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                  Enterprise Knowledge Platform
                </p>
                <div className="space-y-2">
                  <h1 className="text-3xl font-semibold tracking-tight text-slate-950 lg:text-4xl">
                    Dashboard
                  </h1>
                  <p className="max-w-2xl text-sm leading-6 text-slate-600 lg:text-base">
                    Central command for document ingestion, trusted Q&A, and
                    operational visibility across the knowledge platform.
                  </p>
                </div>
              </div>

              <div className="flex flex-col items-start gap-3 lg:items-end">
                <div className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800">
                  {data.isLoading
                    ? "Loading live data"
                    : data.hasDataError
                      ? "Degraded data refresh"
                      : "Live product data"}
                </div>
              </div>
            </div>

            <p className="max-w-3xl text-sm text-slate-500">
              The homepage now presents the product as an enterprise system,
              not a chat demo. Ask is the primary workflow, while Debug remains
              a subdued entry point for experiments.
            </p>
          </div>
        </header>

        <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric) => (
            <MetricCard
              key={metric.label}
              label={metric.label}
              value={metric.value}
              detail={metric.detail}
            />
          ))}
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-950">
                  Recent runs
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Latest question-answer executions and observability signals.
                </p>
              </div>

              <Link
                href="/runs"
                className="rounded-full border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              >
                View all
              </Link>
            </div>

            <div className="mt-5 space-y-3">
              {data.isLoading ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                  Loading recent runs...
                </div>
              ) : data.runs.items.length > 0 ? (
                data.runs.items.map((run) => {
                  const status = getRunStatus(run);

                  return (
                    <article
                      key={run.id}
                      className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-slate-950">
                            {run.question}
                          </p>
                          <p className="mt-1 text-sm text-slate-600 line-clamp-2">
                            {run.answer || "No answer captured yet."}
                          </p>
                        </div>

                        <div className="flex shrink-0 flex-wrap items-center gap-2 text-xs">
                          <span
                            className={`rounded-full px-2.5 py-1 font-medium ${
                              status.tone === "error"
                                ? "bg-rose-100 text-rose-700"
                                : "bg-emerald-100 text-emerald-700"
                            }`}
                          >
                            {status.label}
                          </span>
                          <span className="rounded-full bg-white px-2.5 py-1 font-medium text-slate-600">
                            {run.matched_count ?? 0} hits
                          </span>
                          <span className="rounded-full bg-white px-2.5 py-1 font-medium text-slate-600">
                            {run.duration_ms ?? "n/a"}
                            {run.duration_ms != null ? " ms" : ""}
                          </span>
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-between gap-4 text-xs text-slate-500">
                        <span>Run #{run.id}</span>
                        <span>{formatDateTime(run.created_at)}</span>
                      </div>
                    </article>
                  );
                })
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                  No runs yet. Once questions are asked, this area will show
                  retrieval quality and execution timing.
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-950">
                    Recent documents
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Freshly ingested or updated knowledge assets.
                  </p>
                </div>

                <Link
                  href="/documents"
                  className="text-sm font-medium text-slate-700 hover:text-slate-950"
                >
                  Documents
                </Link>
              </div>

              <div className="mt-5 space-y-3">
                {data.isLoading ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                    Loading recent documents...
                  </div>
                ) : data.documents.items.length > 0 ? (
                  data.documents.items.map((document) => (
                    <article
                      key={document.id}
                      className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-slate-950">
                            {document.name}
                          </p>
                          <p className="mt-1 line-clamp-2 text-sm text-slate-600">
                            {document.content_preview || "No content preview."}
                          </p>
                        </div>

                        <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-600">
                          {document.chunk_count} chunks
                        </span>
                      </div>

                      <div className="mt-3 flex items-center justify-between gap-4 text-xs text-slate-500">
                        <span>Document #{document.id}</span>
                        <span>{formatDateTime(document.created_at)}</span>
                      </div>
                    </article>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                    No documents available yet.
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-950">
                Quick links
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Primary product entry points and the lower-emphasis debug area.
              </p>

              <div className="mt-4 grid gap-3">
                {quickLinks.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="group rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:border-slate-300 hover:bg-white"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-slate-950">
                          {item.label}
                        </p>
                        <p className="mt-1 text-sm text-slate-600">
                          {item.description}
                        </p>
                      </div>
                      <span className="text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-slate-700">
                        →
                      </span>
                    </div>
                  </Link>
                ))}

                <Link
                  href="/debug"
                  className="rounded-2xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500 transition hover:border-slate-400 hover:text-slate-700"
                >
                  Debug area for workflow and search experiments.
                </Link>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
