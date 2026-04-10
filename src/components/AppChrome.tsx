"use client";

import { usePathname } from "next/navigation";
import AppShellNav from "@/components/AppShellNav";

const hiddenPrimaryNavPrefixes = ["/debug/workflow", "/debug/search"];
const hiddenPrimaryNavExact = ["/agent"];

export default function AppChrome() {
  const pathname = usePathname();

  const hidePrimaryNav =
    hiddenPrimaryNavExact.includes(pathname) ||
    hiddenPrimaryNavPrefixes.some((prefix) => pathname.startsWith(prefix));

  if (hidePrimaryNav) {
    return null;
  }

  return (
    <div className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="flex h-16 w-full items-center px-4 sm:px-6">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
            Enterprise Knowledge Hub
          </p>
        </div>
        <div className="ml-4 min-w-0 flex-1">
          <AppShellNav secondaryItems={[{ href: "/debug", label: "Debug" }]} />
        </div>
      </div>
    </div>
  );
}
