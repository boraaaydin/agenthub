export const PLAN_STATUSES = ["registered", "executing", "executed", "completed", "cancelled"] as const;

export type PlanStatus = (typeof PLAN_STATUSES)[number];

export const DEFAULT_PLAN_STATUS: PlanStatus = "registered";

export const PLAN_STATUS_LABELS: Record<PlanStatus, string> = {
  registered: "Registered",
  executing: "Executing",
  executed: "Executed",
  completed: "Completed",
  cancelled: "Cancelled",
};

const PLAN_STATUS_BADGE_CLASSES: Record<PlanStatus, string> = {
  registered: "bg-slate-100 text-slate-600",
  executing: "bg-sky-100 text-sky-800",
  executed: "bg-violet-100 text-violet-800",
  completed: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-rose-100 text-rose-800",
};

export function isPlanStatus(value: unknown): value is PlanStatus {
  return typeof value === "string" && PLAN_STATUSES.includes(value as PlanStatus);
}

export function planStatusLabel(status: PlanStatus): string {
  return PLAN_STATUS_LABELS[status];
}

export function planStatusBadgeClass(status: PlanStatus): string {
  return PLAN_STATUS_BADGE_CLASSES[status];
}

type PlansHrefInput = {
  projectId?: string;
  page?: number;
};

export function planDetailHref(planId: number): string {
  return `/plans/${planId}`;
}

export function newPlanHref(projectId?: string): string {
  return projectId ? `/plans/new?project=${encodeURIComponent(projectId)}` : "/plans/new";
}

export function plansHref({ projectId, page }: PlansHrefInput): string {
  const searchParams = new URLSearchParams();
  if (projectId) {
    searchParams.set("project", projectId);
  }
  if (page !== undefined) {
    searchParams.set("page", String(page));
  }

  const query = searchParams.toString();
  return query ? `/plans?${query}` : "/plans";
}
