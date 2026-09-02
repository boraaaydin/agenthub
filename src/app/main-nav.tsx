"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/projects", label: "Projects" },
  { href: "/tasks", label: "Tasks" },
  { href: "/plans", label: "Plans" },
  { href: "/console", label: "Console" },
  { href: "/settings", label: "Settings" },
];

export function MainNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Main navigation" className="flex flex-wrap items-center gap-x-3 gap-y-1">
      {links.map((link) => {
        const isCurrent = pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={isCurrent ? "page" : undefined}
            className={isCurrent
              ? "rounded bg-sky-100 px-1 py-0.5 text-sm font-medium text-sky-900 transition focus:outline-none focus:ring-3 focus:ring-sky-100"
              : "rounded px-1 py-0.5 text-sm font-medium text-slate-600 transition hover:text-sky-800 focus:outline-none focus:ring-3 focus:ring-sky-100"
            }
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
