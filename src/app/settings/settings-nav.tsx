"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { SETTINGS_PROMPTS } from "@/lib/settings-prompts";

const destinations = [
  { href: "/settings", label: "Agents" },
  { href: "/settings/projects", label: "Projects" },
  { href: "/settings/remote-access", label: "Remote access" },
  ...SETTINGS_PROMPTS.map((prompt) => ({
    href: `/settings/prompts/${prompt.slug}`,
    label: prompt.navLabel,
  })),
];

export default function SettingsNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Settings sections" className="lg:pr-2">
      <ul className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
        {destinations.map((destination) => {
          const isActive = pathname === destination.href;

          return (
            <li key={destination.href} className="shrink-0">
              <Link
                href={destination.href}
                aria-current={isActive ? "page" : undefined}
                className={`block rounded-xl px-3 py-2.5 text-sm font-medium transition focus:outline-none focus:ring-3 focus:ring-sky-100 ${
                  isActive
                    ? "bg-sky-100 text-sky-900"
                    : "text-slate-600 hover:bg-white hover:text-slate-900"
                }`}
              >
                {destination.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
