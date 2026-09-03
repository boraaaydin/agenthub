export const WORKITEM_STATUSES = ["open", "task_creating", "task_created", "in_progress", "completed", "cancelled"] as const;

export type WorkitemStatus = (typeof WORKITEM_STATUSES)[number];
export type WorkitemFilterStatus = WorkitemStatus | "all" | "active";

export const DEFAULT_WORKITEM_STATUS: WorkitemStatus = "open";
export const TERMINAL_WORKITEM_STATUSES = ["completed", "cancelled"] as const;
export const ACTIVE_WORKITEM_STATUSES = WORKITEM_STATUSES.filter(
  (status) => !TERMINAL_WORKITEM_STATUSES.includes(status as (typeof TERMINAL_WORKITEM_STATUSES)[number]),
);
export const DEFAULT_WORKITEM_FILTER_STATUS: WorkitemFilterStatus = "active";

export const WORKITEM_STATUS_LABELS: Record<WorkitemStatus, string> = {
  open: "Open",
  task_creating: "Task creating",
  task_created: "Task created",
  in_progress: "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

const WORKITEM_STATUS_BADGE_CLASSES: Record<WorkitemStatus, string> = {
  open: "bg-slate-100 text-slate-600",
  task_creating: "bg-amber-100 text-amber-800",
  task_created: "bg-violet-100 text-violet-800",
  in_progress: "bg-sky-100 text-sky-800",
  completed: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-slate-200 text-slate-700",
};

export function isWorkitemStatus(value: unknown): value is WorkitemStatus {
  return typeof value === "string" && WORKITEM_STATUSES.includes(value as WorkitemStatus);
}

export function workitemStatusLabel(status: WorkitemStatus): string {
  return WORKITEM_STATUS_LABELS[status];
}

export function workitemStatusBadgeClass(status: WorkitemStatus): string {
  return WORKITEM_STATUS_BADGE_CLASSES[status];
}

export function workitemFilterStatus(value: string | undefined, showAll?: string): WorkitemFilterStatus {
  if (showAll === "true") return "all";
  return isWorkitemStatus(value) ? value : DEFAULT_WORKITEM_FILTER_STATUS;
}

type WorkitemsHrefInput = { projectId?: string; status?: WorkitemFilterStatus; page?: number };

export function workitemsHref({ projectId, status, page }: WorkitemsHrefInput): string {
  const searchParams = new URLSearchParams();
  if (projectId) searchParams.set("project", projectId);
  if (status === "all") searchParams.set("all", "true");
  else if (status && status !== DEFAULT_WORKITEM_FILTER_STATUS) searchParams.set("status", status);
  if (page !== undefined) searchParams.set("page", String(page));
  const query = searchParams.toString();
  return query ? `/workitems?${query}` : "/workitems";
}

export function newWorkitemHref({ projectId, status }: Omit<WorkitemsHrefInput, "page">): string {
  const searchParams = new URLSearchParams();
  if (projectId) searchParams.set("project", projectId);
  if (status === "all") searchParams.set("all", "true");
  else if (status && status !== DEFAULT_WORKITEM_FILTER_STATUS) searchParams.set("status", status);
  const query = searchParams.toString();
  return query ? `/workitems/new?${query}` : "/workitems/new";
}
