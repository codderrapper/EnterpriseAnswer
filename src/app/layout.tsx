import "./globals.css";
import type { Metadata } from "next";
import AppChrome from "@/components/AppChrome";

export const metadata: Metadata = {
  title: "Enterprise Knowledge Hub",
  description:
    "面向企业内部知识检索与智能问答的作品集项目，覆盖 Dashboard、Ask、Documents、Runs、Strategy 与 Debug。",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body
        className="
          min-h-screen antialiased
          font-sans
        "
        style={{
          // ✅ 系统字体栈：无外网依赖，构建最稳（国内很常用）
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji"',
        }}
      >
        <div className="flex h-screen flex-col overflow-hidden bg-slate-100 text-slate-900">
          <AppChrome />
          <div className="flex-1 min-h-0">{children}</div>
        </div>
      </body>
    </html>
  );
}
