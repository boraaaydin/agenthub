type ComposePlanPromptOptions = {
  planPrompt: string;
  planPostPrompt: string;
  projectId: string;
  taskId: number;
  taskTitle: string;
  taskDetail: string;
  plansEndpoint?: string;
};

function registerPlanPrompt({ projectId, taskId, plansEndpoint }: Pick<ComposePlanPromptOptions, "projectId" | "taskId" | "plansEndpoint">): string {
  if (!plansEndpoint) {
    return "";
  }

  return [
    "## Register the plan in AgentHub",
    `POST ${plansEndpoint} with Content-Type: application/json.`,
    "After the task file is final and before ending the CLI process or following the exit step above, register it with:",
    `curl -X POST "${plansEndpoint}" -H "Content-Type: application/json" -d '{"projectId":"${projectId}","taskId":${taskId},"title":"PLAN_TITLE","filePath":".agent/tasks/PLAN_FILE.md","summary":"One or two sentence summary."}'`,
    "Replace PLAN_TITLE, filePath, and summary with the finished plan's title, repository-relative task-file path, and one or two sentence summary.",
    "If the response is not 201, report that failure in your final summary, then still finish and exit; do not retry in a loop.",
  ].join("\n\n");
}

export function composePlanPrompt(options: ComposePlanPromptOptions): string {
  const sections = [
    options.planPrompt.trim(),
    `## Task #${options.taskId}: ${options.taskTitle.trim()}\n\n${options.taskDetail.trim() || "No detail provided."}`,
    options.planPostPrompt.trim(),
  ];
  const registration = registerPlanPrompt(options);
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
