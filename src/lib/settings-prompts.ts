export const SETTINGS_PROMPTS = [
  {
    slug: "plan",
    field: "planPrompt",
    navLabel: "Task planning prompt",
    title: "Task planning prompt",
    description: "Runs when a task is being planned.",
  },
  {
    slug: "plan-post",
    field: "planPostPrompt",
    navLabel: "After planning prompt",
    title: "After planning prompt",
    description: "Runs after task planning finishes.",
  },
  {
    slug: "task",
    field: "taskPrompt",
    navLabel: "Task execution prompt",
    title: "Task execution prompt",
    description: "Runs when a task is being executed.",
  },
  {
    slug: "task-post",
    field: "taskPostPrompt",
    navLabel: "After task prompt",
    title: "After task prompt",
    description: "Runs after a task finishes.",
  },
] as const;

export type SettingsPrompt = (typeof SETTINGS_PROMPTS)[number];
export type SettingsPromptField = SettingsPrompt["field"];
