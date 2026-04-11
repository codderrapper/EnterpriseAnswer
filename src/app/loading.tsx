/**
 * ⭐ 企业级最佳实践：Next.js 路由骨架屏
 * 作用：消除导航阻塞感。有了这个文件，点击菜单会瞬间跳转，不再原地等待。
 */

export default function GlobalLoading() {
  return (
    <div className="flex h-[calc(100vh-4rem)] w-full flex-col bg-slate-50 px-6 py-8">
      {/* 1. 顶部标题骨架 */}
      <div className="mb-8 space-y-3">
        <div className="h-4 w-32 animate-pulse rounded bg-slate-200" />
        <div className="h-8 w-64 animate-pulse rounded-lg bg-slate-300" />
        <div className="h-4 w-full max-w-2xl animate-pulse rounded bg-slate-200" />
      </div>

      {/* 2. 内容网格骨架 */}
      <div className="grid flex-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="flex flex-col space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div className="h-4 w-24 animate-pulse rounded bg-slate-200" />
              <div className="h-6 w-12 animate-pulse rounded-full bg-slate-100" />
            </div>
            <div className="space-y-2">
              <div className="h-3 w-full animate-pulse rounded bg-slate-100" />
              <div className="h-3 w-5/6 animate-pulse rounded bg-slate-100" />
            </div>
            <div className="mt-auto h-4 w-16 animate-pulse rounded bg-blue-50" />
          </div>
        ))}
      </div>
    </div>
  );
}
