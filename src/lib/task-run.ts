import { applyPromptTokens, type ProjectPromptTokens } from "@/lib/prompt-tokens";

type ComposeTaskPromptOptions = ProjectPromptTokens & {
  taskPrompt: string;
  taskPostPrompt: string;
  planId: number;
  taskId: number;
  planTitle: string;
  filePath: string;
  summary: string;
};

function taskFileSection({ planId, taskId, planTitle, filePath, summary }: Omit<ComposeTaskPromptOptions, "taskPrompt" | "taskPostPrompt">): string {
  const details = [
    "## Task file",
    `Plan #${planId}`,
    `Task #${taskId}: ${planTitle.trim()}`,
    `Repository-relative file path: ${filePath}`,
  ];
  if (summary.trim()) {
    details.push(`Plan summary: ${summary.trim()}`);
  }

  return details.join("\n\n");
}

export function composeTaskPrompt(options: ComposeTaskPromptOptions): string {
  const project = { projectName: options.projectName, projectPath: options.projectPath };
  return [
    applyPromptTokens(options.taskPrompt.trim(), project),
    taskFileSection(options),
    applyPromptTokens(options.taskPostPrompt.trim(), project),
  ].join("\n\n---\n\n");
}

export function taskConsoleHref(planId: number): string {
  return `/console?${new URLSearchParams({ taskPlanId: String(planId) }).toString()}`;
}
