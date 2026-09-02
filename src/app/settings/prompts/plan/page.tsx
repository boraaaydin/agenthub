import { SETTINGS_PROMPTS } from "@/lib/settings-prompts";

import PromptSettingsPage from "../prompt-settings-page";

export const dynamic = "force-dynamic";

export default function PlanPromptPage() {
  return <PromptSettingsPage prompt={SETTINGS_PROMPTS[0]} />;
}
