import { applyPromptTokens, projectSlug, type ProjectPromptTokens } from "@/lib/prompt-tokens";

type ComposePlanPromptOptions = ProjectPromptTokens & {
  planPrompt: string;
  planPostPrompt: string;
  projectId: string;
  workitemId: number;
  taskTitle: string;
  taskDetail: string;
  tasksEndpoint?: string;
};

function planLanguageSection(project: ProjectPromptTokens): string {
  return [
    "## Plan language",
    "Write the plan in the same language as the task title and detail above; infer that language from that text.",
    "This covers the task file's prose, the plan title, and the plan summary registered with AgentHub through POST /api/tasks.",
    "If the task text explicitly asks for another language, use the requested language instead.",
    `Regardless of language, keep the Markdown section headings, the \`Root application (\`${projectSlug(project)}\`)\` line, the lowercase kebab-case English file name, file paths, commands, and code identifiers in English.`,
  ].join("\n\n");
}

function registerPlanPrompt({ projectId, workitemId, tasksEndpoint }: Pick<ComposePlanPromptOptions, "projectId" | "workitemId" | "tasksEndpoint">): string {
  if (!tasksEndpoint) {
    return "";
  }

  return [
    "## Register the plan in AgentHub",
    `POST ${tasksEndpoint} with Content-Type: application/json.`,
    "After the task file is final and before ending the CLI process or following the exit step above, register it with:",
    `curl -X POST "${tasksEndpoint}" -H "Content-Type: application/json" -d '{"projectId":"${projectId}","workitemId":${workitemId},"title":"PLAN_TITLE","filePath":".agent/tasks/PLAN_FILE.md","summary":"One or two sentence summary."}'`,
    "Replace PLAN_TITLE, filePath, and summary with the finished plan's title, repository-relative task-file path, and one or two sentence summary.",
    "If the response is not 201, report that failure in your final summary, then still finish and exit; do not retry in a loop.",
  ].join("\n\n");
}

export function composePlanPrompt(options: ComposePlanPromptOptions): string {
  const project = {
    projectName: options.projectName,
    projectPath: options.projectPath,
    projectSlug: options.projectSlug,
  };
  const sections = [
    applyPromptTokens(options.planPrompt.trim(), project),
    `## Workitem #${options.workitemId}: ${options.taskTitle.trim()}\n\n${options.taskDetail.trim() || "No detail provided."}`,
    planLanguageSection(project),
    applyPromptTokens(options.planPostPrompt.trim(), project),
  ];
  const registration = registerPlanPrompt(options);
  if (registration) {
    sections.push(registration);
  }

  return sections.join("\n\n---\n\n");
}

export function planConsoleHref(projectId: string, workitemId: number): string {
  const searchParams = new URLSearchParams({
    planProjectId: projectId,
    planWorkitemId: String(workitemId),
  });
  return `/console?${searchParams.toString()}`;
}
