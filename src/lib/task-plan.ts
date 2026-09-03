import { applyPromptTokens, projectSlug, type ProjectPromptTokens } from "@/lib/prompt-tokens";

type ComposePlanPromptOptions = ProjectPromptTokens & {
  planPrompt: string;
  planPostPrompt: string;
  projectId: string;
  taskId: number;
  taskTitle: string;
  taskDetail: string;
  plansEndpoint?: string;
};

function planLanguageSection(project: ProjectPromptTokens): string {
  return [
    "## Plan language",
    "Write the plan in the same language as the task title and detail above; infer that language from that text.",
    "This covers the plan file's prose, the plan title, and the plan summary registered with AgentHub through POST /api/plans.",
    "If the task text explicitly asks for another language, use the requested language instead.",
    `Regardless of language, keep the Markdown section headings, the \`Root application (\`${projectSlug(project)}\`)\` line, the lowercase kebab-case English file name, file paths, commands, and code identifiers in English.`,
  ].join("\n\n");
}

function planFilePath(project: ProjectPromptTokens, taskId: number, fileName: string): string {
  return `.agent/plans/${projectSlug(project)}#${taskId}-${fileName}.md`;
}

function planFileSection(project: ProjectPromptTokens, taskId: number): string {
  return [
    "## Plan file",
    "Create the `.agent/plans/` directory if it does not exist, then write the plan there.",
    `Name the file \`{PROJECT_SLUG}#{TASK_ID}-{descriptive-kebab-case-name}.md\`; for this task, use a path such as \`${planFilePath(project, taskId, "descriptive-kebab-case-name")}\`.`,
  ].join("\n\n");
}

function registerPlanPrompt({ project, projectId, taskId, plansEndpoint }: Pick<ComposePlanPromptOptions, "projectId" | "taskId" | "plansEndpoint"> & { project: ProjectPromptTokens }): string {
  if (!plansEndpoint) {
    return "";
  }

  return [
    "## Register the plan in AgentHub",
    `POST ${plansEndpoint} with Content-Type: application/json.`,
    "After the plan file is final and before ending the CLI process or following the exit step above, register it with:",
    `curl -X POST "${plansEndpoint}" -H "Content-Type: application/json" -d '{"projectId":"${projectId}","taskId":${taskId},"title":"PLAN_TITLE","filePath":"${planFilePath(project, taskId, "PLAN_FILE")}","summary":"One or two sentence summary."}'`,
    "Replace PLAN_TITLE, filePath, and summary with the finished plan's title, repository-relative plan-file path, and one or two sentence summary.",
    "If the response is not 201, report that failure in your final summary, then still finish and exit; do not retry in a loop.",
  ].join("\n\n");
}

export function composePlanPrompt(options: ComposePlanPromptOptions): string {
  const project = { projectName: options.projectName, projectPath: options.projectPath };
  const sections = [
    applyPromptTokens(options.planPrompt.trim(), project),
    `## Task #${options.taskId}: ${options.taskTitle.trim()}\n\n${options.taskDetail.trim() || "No detail provided."}`,
    planLanguageSection(project),
    planFileSection(project, options.taskId),
    applyPromptTokens(options.planPostPrompt.trim(), project),
  ];
  const registration = registerPlanPrompt({ ...options, project });
  if (registration) {
    sections.push(registration);
  }

  return sections.join("\n\n---\n\n");
}

export function planConsoleHref(projectId: string, taskId: number): string {
  const searchParams = new URLSearchParams({
    planProjectId: projectId,
    planTaskId: String(taskId),
  });
  return `/console?${searchParams.toString()}`;
}
