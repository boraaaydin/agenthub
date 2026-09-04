import ProjectsSettingsForm from "./projects-settings-form";
import { isGitAvailable } from "@/lib/git";
import { defaultSettings, readSettings, SettingsStoreError } from "@/lib/settings-store";

export const dynamic = "force-dynamic";

export default async function ProjectsSettingsPage() {
  let settings = defaultSettings();
  let error = "";

  try {
    settings = await readSettings();
  } catch (caughtError) {
    console.error("Unable to render project settings", caughtError);
    error = caughtError instanceof SettingsStoreError
      ? "Settings could not be read. Check data/settings.json, then save valid settings to replace it."
      : "Settings could not be loaded. Reload this page and try again.";
  }

  const gitAvailable = await isGitAvailable();

  return (
    <>
      <div className="mb-8">
        <h2 className="text-xl font-semibold tracking-[-0.02em] text-slate-900">Projects</h2>
        <p className="mt-1 text-sm leading-6 text-slate-600">
          Choose where AgentHub creates local project folders.
        </p>
      </div>
      {error && <p role="alert" className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
      <ProjectsSettingsForm
        defaultProjectPath={settings.defaultProjectPath}
        initializeGitInNewProjects={settings.initializeGitInNewProjects}
        gitAvailable={gitAvailable}
      />
    </>
  );
}
