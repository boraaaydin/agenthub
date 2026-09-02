import Link from "next/link";

import { BrandLink } from "../brand-link";
import SettingsNav from "./settings-nav";

export default function SettingsLayout({ children }: LayoutProps<"/settings">) {
  return (
    <main className="min-h-screen bg-[#f4f6fa] px-4 py-6 text-slate-900 sm:px-6 sm:py-10">
      <div className="mx-auto w-full max-w-6xl">
        <header className="border-b border-slate-200 pb-5">
          <BrandLink />
          <div className="mt-3">
            <Link
              href="/projects"
              className="text-sm font-medium text-sky-700 transition hover:text-sky-900 focus:outline-none focus:ring-3 focus:ring-sky-100"
            >
              Projects
            </Link>
          </div>
          <h1 className="mt-4 text-3xl font-semibold tracking-[-0.03em]">Settings</h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
            Manage the defaults and prompts used across all of your local projects.
          </p>
        </header>

        <div className="mt-8 grid gap-8 lg:grid-cols-[14rem_minmax(0,1fr)]">
          <SettingsNav />
          <div className="min-w-0">{children}</div>
        </div>
      </div>
    </main>
  );
}
