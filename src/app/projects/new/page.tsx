import Link from "next/link";
import { headers } from "next/headers";

import NewProjectForm from "./new-project-form";
import { BrandBar } from "../../brand-bar";
import { LocalOnlyNotice } from "../../local-only-notice";
import { isGitAvailable } from "@/lib/git";
import { defaultSettings, readSettings, SettingsStoreError } from "@/lib/settings-store";
import { isLocalClient } from "@/lib/request-origin";

export const dynamic = "force-dynamic";

export default async function NewProjectPage() {
  if (!isLocalClient(await headers())) {
    return (
      <main className="min-h-screen bg-[#f4f6fa] px-4 py-6 text-slate-900 sm:px-6 sm:py-10">
        <div className="mx-auto w-full max-w-2xl">
          <BrandBar />
          <Link
            href="/projects"
            className="mt-3 inline-block text-sm font-medium text-sky-700 transition hover:text-sky-900 focus:outline-none focus:ring-3 focus:ring-sky-100"
          >
            Projects
          </Link>
          <h1 className="mt-4 text-3xl font-semibold tracking-[-0.03em]">New project</h1>
          <div className="mt-6">
            <LocalOnlyNotice />
          </div>
        </div>
      </main>
    );
  }

  let settings = defaultSettings();
  let settingsError = "";

  try {
    settings = await readSettings();
  } catch (error) {
    console.error("Unable to load project settings", error);
    settingsError = error instanceof SettingsStoreError
      ? "Project settings could not be read. You can still use an existing directory."
      : "Project settings could not be loaded. You can still use an existing directory.";
  }

  return (
    <NewProjectForm
      defaultProjectPath={settings.defaultProjectPath}
      initializeGitInNewProjects={settings.initializeGitInNewProjects}
      gitAvailable={await isGitAvailable()}
      settingsError={settingsError}
    />
  );
}
