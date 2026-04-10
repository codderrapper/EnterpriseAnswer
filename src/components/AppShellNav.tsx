"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavItem = {
  href: string;
  label: string;
};

const primaryNavItems: NavItem[] = [
  { href: "/", label: "Dashboard" },
  { href: "/ask", label: "Ask" },
  { href: "/documents", label: "Documents" },
  { href: "/runs", label: "Runs" },
  { href: "/prompts", label: "Strategy" },
];

export function getPrimaryNavItems() {
  return primaryNavItems;
}

type AppShellNavProps = {
  secondaryItems?: NavItem[];
};

function isActive(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function AppShellNav({
  secondaryItems = [],
}: AppShellNavProps) {
  const pathname = usePathname();
  const primaryItems = getPrimaryNavItems();

  return (
    <nav className="flex flex-wrap items-center gap-2 text-sm">
      {primaryItems.map((item) => {
        const active = isActive(pathname, item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={
              active
                ? "rounded-md bg-slate-900 px-3 py-1.5 font-medium text-white"
                : "rounded-md px-3 py-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }
          >
            {item.label}
          </Link>
        );
      })}

      {secondaryItems.length > 0 ? (
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {secondaryItems.map((item) => {
            const active = isActive(pathname, item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={
                  active
                    ? "rounded-md bg-slate-100 px-3 py-1.5 font-medium text-slate-900"
                    : "rounded-md px-3 py-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                }
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      ) : null}
    </nav>
  );
}
