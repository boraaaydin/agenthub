import Link from "next/link";

import { BrandBar } from "./brand-bar";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f4f6fa] px-4 py-6 text-slate-900 sm:px-6 sm:py-10">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <header className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end">
          <div>
            <BrandBar />
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.03em]">Home</h1>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
              Keep your local coding projects ready for an agent session.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/settings"
              className="h-11 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium leading-none text-slate-800 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-3 focus:ring-sky-100"
            >
              Settings
            </Link>
            <Link
              href="/console"
              className="h-11 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium leading-none text-slate-800 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-3 focus:ring-sky-100"
            >
              Open console
            </Link>
            <Link
              href="/tasks"
              className="h-11 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium leading-none text-slate-800 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-3 focus:ring-sky-100"
            >
              Tasks
            </Link>
            <Link
              href="/plans"
              className="h-11 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium leading-none text-slate-800 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-3 focus:ring-sky-100"
            >
              Plans
            </Link>
            <Link
              href="/projects"
              className="h-11 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium leading-none text-slate-800 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-3 focus:ring-sky-100"
            >
              Projects
            </Link>
          </div>
        </header>
      </div>
    </main>
  );
}
