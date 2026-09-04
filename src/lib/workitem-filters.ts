export const WORKITEM_STATUSES = ["open", "task_creating", "task_created", "in_progress", "completed", "cancelled"] as const;

export type WorkitemStatus = (typeof WORKITEM_STATUSES)[number];
export const WORKITEM_KINDS = ["workitem", "draft"] as const;
export type WorkitemKind = (typeof WORKITEM_KINDS)[number];
export type WorkitemFilterStatus = WorkitemStatus | "all" | "active" | "draft";

export const DEFAULT_WORKITEM_STATUS: WorkitemStatus = "open";
export const DEFAULT_WORKITEM_KIND: WorkitemKind = "workitem";
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

export type WorkitemDependency = {
  id: number;
  title: string;
  status: WorkitemStatus;
};

export function isWorkitemStatus(value: unknown): value is WorkitemStatus {
  return typeof value === "string" && WORKITEM_STATUSES.includes(value as WorkitemStatus);
}

export function isWorkitemKind(value: unknown): value is WorkitemKind {
  return typeof value === "string" && WORKITEM_KINDS.includes(value as WorkitemKind);
}

export function workitemKindLabel(kind: WorkitemKind): string {
  return kind === "draft" ? "Draft" : "Workitem";
}

export function workitemKindBadgeClass(kind: WorkitemKind): string {
  return kind === "draft"
    ? "border border-dashed border-slate-300 bg-white text-slate-600"
    : "bg-slate-100 text-slate-600";
}

export function isDependencyFinished(status: WorkitemStatus): boolean {
  return TERMINAL_WORKITEM_STATUSES.includes(status as (typeof TERMINAL_WORKITEM_STATUSES)[number]);
}

export function blockingDependencies(
  dependencyIds: readonly number[],
  dependenciesById: ReadonlyMap<number, WorkitemDependency>,
): WorkitemDependency[] {
  return dependencyIds
    .map((dependencyId) => dependenciesById.get(dependencyId))
    .filter((dependency): dependency is WorkitemDependency => (
      dependency !== undefined && !isDependencyFinished(dependency.status)
    ));
}

export function workitemStatusLabel(status: WorkitemStatus): string {
  return WORKITEM_STATUS_LABELS[status];
}

export function workitemStatusBadgeClass(status: WorkitemStatus): string {
  return WORKITEM_STATUS_BADGE_CLASSES[status];
}

export function workitemFilterStatus(
  value: string | undefined,
  showAll?: string,
  kind?: string,
): WorkitemFilterStatus {
  if (kind === "draft") return "draft";
  if (showAll === "true") return "all";
  return isWorkitemStatus(value) ? value : DEFAULT_WORKITEM_FILTER_STATUS;
}

type WorkitemsHrefInput = { projectId?: string; status?: WorkitemFilterStatus; page?: number };

export function workitemsHref({ projectId, status, page }: WorkitemsHrefInput): string {
  const searchParams = new URLSearchParams();
  if (projectId) searchParams.set("project", projectId);
  if (status === "draft") searchParams.set("kind", "draft");
  else if (status === "all") searchParams.set("all", "true");
  else if (status && status !== DEFAULT_WORKITEM_FILTER_STATUS) searchParams.set("status", status);
  if (page !== undefined) searchParams.set("page", String(page));
  const query = searchParams.toString();
  return query ? `/workitems?${query}` : "/workitems";
}

export function newWorkitemHref({ projectId, status }: Omit<WorkitemsHrefInput, "page">): string {
  const searchParams = new URLSearchParams();
  if (projectId) searchParams.set("project", projectId);
  if (status === "draft") searchParams.set("kind", "draft");
  else if (status === "all") searchParams.set("all", "true");
  else if (status && status !== DEFAULT_WORKITEM_FILTER_STATUS) searchParams.set("status", status);
  const query = searchParams.toString();
  return query ? `/workitems/new?${query}` : "/workitems/new";
}
