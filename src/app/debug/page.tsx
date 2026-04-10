import Link from "next/link";

export const metadata = {
  title: "Debug",
};

export default function DebugPage() {
  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <div className="flex min-h-screen w-full flex-col px-6 py-8">
        <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
              Knowledge Platform
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-slate-950">Debug</h1>
            <p className="mt-2 text-sm text-slate-600">
              Internal workflow and search labs for experimenting with retrieval
              quality, graph-based orchestration, and developer-facing tooling.
            </p>
          </div>
          <div className="mt-4 flex flex-wrap gap-2 text-sm">
            <Link
              href="/debug/workflow"
              className="rounded-md bg-slate-900 px-3 py-1.5 font-medium text-white"
            >
              Workflow Lab
            </Link>
            <Link
              href="/debug/search"
              className="rounded-md bg-slate-100 px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-200"
            >
              Search Lab
            </Link>
          </div>
        </header>

        <section className="mt-6 grid gap-4 md:grid-cols-2">
          <Link
            href="/debug/workflow"
            className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Experimental Workflow
            </p>
            <h2 className="mt-3 text-lg font-semibold text-slate-950">
              Workflow Lab
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Inspect the experimental CRAG graph, step traces, and node-level
              workflow execution details.
            </p>
          </Link>

          <Link
            href="/debug/search"
            className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Retrieval Tuning
            </p>
            <h2 className="mt-3 text-lg font-semibold text-slate-950">
              Search Lab
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Run rewrite, rerank, and strategy experiments against the search
              pipeline and review answers, steps, and sources together.
            </p>
          </Link>
        </section>
      </div>
    </main>
  );
}
