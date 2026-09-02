import { readDefaultSettingsPrompt } from "@/lib/default-settings-prompts";
import type { SettingsPrompt } from "@/lib/settings-prompts";
import { defaultSettings, readSettings, SettingsStoreError } from "@/lib/settings-store";

import PromptForm from "./prompt-form";

type PromptSettingsPageProps = {
  prompt: SettingsPrompt;
};

export default async function PromptSettingsPage({ prompt }: PromptSettingsPageProps) {
  let settings = defaultSettings();
  let error = "";

  try {
    settings = await readSettings();
  } catch (caughtError) {
    console.error("Unable to render settings prompt", caughtError);
    error = caughtError instanceof SettingsStoreError
      ? "Settings could not be read. Check data/settings.json, then save valid settings to replace it."
      : "Settings could not be loaded. Reload this page and try again.";
  }

  let defaultPrompt = "";
  if (settings[prompt.field] === "") {
    try {
      defaultPrompt = await readDefaultSettingsPrompt(prompt.field);
    } catch (caughtError) {
      console.error("Unable to load default settings prompt", caughtError);
    }
  }

  return (
    <>
      {error && (
        <p role="alert" className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      )}
      <PromptForm
        field={prompt.field}
        value={settings[prompt.field]}
        defaultPrompt={defaultPrompt}
      />
    </>
  );
}
