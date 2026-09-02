export function composePlanPrompt(
  planPrompt: string,
  taskId: number,
  taskTitle: string,
  taskDetail: string,
  planPostPrompt: string,
): string {
  return [
    planPrompt.trim(),
    "---",
    `## Task #${taskId}: ${taskTitle.trim()}`,
    taskDetail.trim() || "No detail provided.",
    "---",
    planPostPrompt.trim(),
  ].join("\n\n");
}

export function planConsoleHref(projectId: string, taskId: number): string {
  const searchParams = new URLSearchParams({
    planProjectId: projectId,
    planTaskId: String(taskId),
  });
  return `/console?${searchParams.toString()}`;
}
