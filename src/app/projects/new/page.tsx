import NewProjectForm from "./new-project-form";
import { isGitAvailable } from "@/lib/git";
import { defaultSettings, readSettings, SettingsStoreError } from "@/lib/settings-store";

export const dynamic = "force-dynamic";

export default async function NewProjectPage() {
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
