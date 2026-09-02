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
