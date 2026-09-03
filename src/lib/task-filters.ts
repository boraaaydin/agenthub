export const TASK_STATUSES = ["created", "executing", "executed", "completed", "cancelled"] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];
export type TaskFilterStatus = TaskStatus | "all" | "active";

export const TERMINAL_TASK_STATUSES = ["completed", "cancelled"] as const;
export const ACTIVE_TASK_STATUSES = TASK_STATUSES.filter(
  (status) => !TERMINAL_TASK_STATUSES.includes(status as (typeof TERMINAL_TASK_STATUSES)[number]),
);
export const DEFAULT_TASK_STATUS: TaskStatus = "created";
export const DEFAULT_TASK_FILTER_STATUS: TaskFilterStatus = "active";

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  created: "Created",
  executing: "Executing",
  executed: "Executed",
  completed: "Completed",
  cancelled: "Cancelled",
};

const TASK_STATUS_BADGE_CLASSES: Record<TaskStatus, string> = {
  created: "bg-slate-100 text-slate-600",
  executing: "bg-sky-100 text-sky-800",
  executed: "bg-violet-100 text-violet-800",
  completed: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-rose-100 text-rose-800",
};

export function isTaskStatus(value: unknown): value is TaskStatus {
  return typeof value === "string" && TASK_STATUSES.includes(value as TaskStatus);
}
export function taskStatusLabel(status: TaskStatus): string { return TASK_STATUS_LABELS[status]; }
export function taskStatusBadgeClass(status: TaskStatus): string { return TASK_STATUS_BADGE_CLASSES[status]; }
export function taskFilterStatus(value: string | undefined, showAll?: string): TaskFilterStatus {
  return showAll === "true" ? "all" : isTaskStatus(value) ? value : DEFAULT_TASK_FILTER_STATUS;
}

type TasksHrefInput = { projectId?: string; status?: TaskFilterStatus; page?: number };
export function taskDetailHref(taskId: number): string { return `/tasks/${taskId}`; }
export function newTaskHref(projectId?: string): string {
  return projectId ? `/tasks/new?project=${encodeURIComponent(projectId)}` : "/tasks/new";
}
export function tasksHref({ projectId, status, page }: TasksHrefInput): string {
  const searchParams = new URLSearchParams();
  if (projectId) searchParams.set("project", projectId);
  if (status === "all") searchParams.set("all", "true");
  else if (status && status !== DEFAULT_TASK_FILTER_STATUS) searchParams.set("status", status);
  if (page !== undefined) searchParams.set("page", String(page));
  const query = searchParams.toString();
  return query ? `/tasks?${query}` : "/tasks";
}
