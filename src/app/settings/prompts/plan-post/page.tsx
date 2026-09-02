import { SETTINGS_PROMPTS } from "@/lib/settings-prompts";

import PromptSettingsPage from "../prompt-settings-page";

export const dynamic = "force-dynamic";

export default function PlanPostPromptPage() {
  return <PromptSettingsPage prompt={SETTINGS_PROMPTS[1]} />;
}
