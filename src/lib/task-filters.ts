export const TASK_STATUSES = ["open", "plan_created", "in_progress", "completed", "cancelled"] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];
export type TaskFilterStatus = TaskStatus | "all";

export const DEFAULT_TASK_STATUS: TaskStatus = "open";
export const TERMINAL_TASK_STATUSES = ["completed", "cancelled"] as const;

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  open: "Open",
  plan_created: "Plan created",
  in_progress: "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

const TASK_STATUS_BADGE_CLASSES: Record<TaskStatus, string> = {
  open: "bg-slate-100 text-slate-600",
  plan_created: "bg-violet-100 text-violet-800",
  in_progress: "bg-sky-100 text-sky-800",
  completed: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-slate-200 text-slate-700",
};

export function isTaskStatus(value: unknown): value is TaskStatus {
  return typeof value === "string" && TASK_STATUSES.includes(value as TaskStatus);
}

export function taskStatusLabel(status: TaskStatus): string {
  return TASK_STATUS_LABELS[status];
}

export function taskStatusBadgeClass(status: TaskStatus): string {
  return TASK_STATUS_BADGE_CLASSES[status];
}

export function taskFilterStatus(value: string | undefined, showAll?: string): TaskFilterStatus {
  if (showAll === "true") {
    return "all";
  }
  return isTaskStatus(value) ? value : DEFAULT_TASK_STATUS;
}

type TasksHrefInput = {
  projectId?: string;
  status?: TaskFilterStatus;
  page?: number;
};

export function tasksHref({ projectId, status, page }: TasksHrefInput): string {
  const searchParams = new URLSearchParams();
  if (projectId) {
    searchParams.set("project", projectId);
  }
  if (status === "all") {
    searchParams.set("all", "true");
  } else if (status) {
    searchParams.set("status", status);
  }
  if (page !== undefined) {
    searchParams.set("page", String(page));
  }

  const query = searchParams.toString();
  return query ? `/tasks?${query}` : "/tasks";
}

export function newTaskHref({ projectId, status }: Omit<TasksHrefInput, "page">): string {
  const searchParams = new URLSearchParams();
  if (projectId) {
    searchParams.set("project", projectId);
  }
  if (status === "all") {
    searchParams.set("all", "true");
  } else if (status) {
    searchParams.set("status", status);
  }

  const query = searchParams.toString();
  return query ? `/tasks/new?${query}` : "/tasks/new";
}
