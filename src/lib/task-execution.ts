import { applyPromptTokens, type ProjectPromptTokens } from "@/lib/prompt-tokens";

type ComposeTaskPromptOptions = ProjectPromptTokens & {
  taskPrompt: string;
  taskPostPrompt: string;
  taskId: number;
  workitemId: number;
  taskTitle: string;
  filePath: string;
  summary: string;
  taskEndpoint?: string;
};

function taskFileSection({ taskId, workitemId, taskTitle, filePath, summary }: Omit<ComposeTaskPromptOptions, "taskPrompt" | "taskPostPrompt">) {
  const details = [
    "## Task file",
    `Task #${taskId}: ${taskTitle.trim()}`,
    `Workitem #${workitemId}`,
    `Repository-relative file path: ${filePath}`,
  ];
  if (summary.trim()) details.push(`Task summary: ${summary.trim()}`);
  return details.join("\n\n");
}

function reportExecutionPrompt({ taskEndpoint }: Pick<ComposeTaskPromptOptions, "taskEndpoint">): string {
  if (!taskEndpoint) {
    return "";
  }

  return [
    "## Report execution completion to AgentHub",
    `PATCH ${taskEndpoint} with Content-Type: application/json once the implementation and all required verification are finished, including the after-task close-out above.`,
    `curl -X PATCH "${taskEndpoint}" -H "Content-Type: application/json" -d '{"status":"executed"}'`,
    "Run this report once. If the run is blocked or fails, do not report it as executed; explain the problem in your final summary instead.",
    "If the response is not 2xx, report that failure in your final summary rather than retrying in a loop.",
    "Do not end your own CLI process after reporting; keep this session interactive.",
  ].join("\n\n");
}

export function composeTaskPrompt(options: ComposeTaskPromptOptions) {
  const project = { projectName: options.projectName, projectPath: options.projectPath };
  const sections = [
    applyPromptTokens(options.taskPrompt.trim(), project),
    taskFileSection(options),
    applyPromptTokens(options.taskPostPrompt.trim(), project),
  ];
  const completion = reportExecutionPrompt(options);
  if (completion) {
    sections.push(completion);
  }

  return sections.join("\n\n---\n\n");
}

export function taskConsoleHref(taskId: number) {
  return `/console?${new URLSearchParams({ runTaskId: String(taskId) }).toString()}`;
}
