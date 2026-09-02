import Link from "next/link";

import { BrandLink } from "../brand-link";
import SettingsForm from "./settings-form";
import { DEFAULT_AGENT_ID } from "@/lib/agents";
import { readSettings, SettingsStoreError, type Settings } from "@/lib/settings-store";

export const dynamic = "force-dynamic";

const defaultSettings: Settings = {
  taskAgent: DEFAULT_AGENT_ID,
  planAgent: DEFAULT_AGENT_ID,
};

export default async function SettingsPage() {
  let settings = defaultSettings;
  let error = "";

  try {
    settings = await readSettings();
  } catch (caughtError) {
    console.error("Unable to render settings", caughtError);
    error = caughtError instanceof SettingsStoreError
      ? "Settings could not be read. Check data/settings.json, then save valid settings to replace it."
      : "Settings could not be loaded. Reload this page and try again.";
  }

  return (
    <main className="min-h-screen bg-[#f4f6fa] px-4 py-6 text-slate-900 sm:px-6 sm:py-10">
      <div className="mx-auto w-full max-w-2xl">
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
          <p className="mt-1 max-w-xl text-sm leading-6 text-slate-600">
            Choose the default agents used across all of your local projects.
          </p>
        </header>

        {error && (
          <p role="alert" className="mt-8 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </p>
        )}

        <SettingsForm settings={settings} />
      </div>
    </main>
  );
}
