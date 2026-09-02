import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

import type { SettingsPromptField } from "./settings-prompts";

const promptFileNames: Record<SettingsPromptField, string> = {
  planPrompt: "plan.md",
  planPostPrompt: "plan-post.md",
  taskPrompt: "task.md",
  taskPostPrompt: "task-post.md",
};

export async function readDefaultSettingsPrompt(field: SettingsPromptField): Promise<string> {
  return readFile(
    path.join(process.cwd(), "src", "lib", "default-prompts", promptFileNames[field]),
    "utf8",
  );
}
