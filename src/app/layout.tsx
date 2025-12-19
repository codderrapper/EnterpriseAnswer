import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "企业文档智能助手",
  description: "Enterprise RAG + Agent platform demo",
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
        {children}
      </body>
    </html>
  );
}
