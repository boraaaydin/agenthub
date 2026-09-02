import Link from "next/link";

import { BrandBar } from "../brand-bar";
import { ProjectChip, UnknownProjectChip } from "../project-chip";
import { ProjectFilter } from "./project-filter";
import { listProjects, ProjectStoreError } from "@/lib/projects-store";
import { newPlanHref, planDetailHref, plansHref } from "@/lib/plan-filters";
import { listAllPlans, PlanStoreError, PLANS_PAGE_SIZE, type Plan } from "@/lib/plans-store";
import { taskConsoleHref } from "@/lib/task-run";

export const dynamic = "force-dynamic";

function planDate(value: string): string {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(value));
}

function PlanRows({ plans, projectNames }: { plans: Plan[]; projectNames: Map<string, { name: string; color?: string }> }) {
  return (
    <section aria-label="All plans" className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <ul className="divide-y divide-slate-200">
        {plans.map((plan) => {
          const project = projectNames.get(plan.projectId);
          return (
            <li key={plan.id} className="px-4 py-4 sm:px-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between sm:gap-5">
                <div className="flex min-w-0 flex-wrap items-baseline gap-2">
                  {project ? (
                    <ProjectChip projectId={plan.projectId} name={project.name} color={project.color} />
                  ) : <UnknownProjectChip />}
                  <span className="shrink-0 text-sm font-medium tabular-nums text-slate-500">#{plan.id}</span>
                  <h2 className="min-w-0 break-words font-medium text-slate-900">
                    <Link href={planDetailHref(plan.id)} className="transition hover:text-sky-800 focus:outline-none focus:ring-3 focus:ring-sky-100">
                      {plan.title}
                    </Link>
                  </h2>
                </div>
                <time className="shrink-0 text-sm text-slate-500" dateTime={plan.createdAt}>{planDate(plan.createdAt)}</time>
              </div>
              <p className="mt-1.5 max-w-3xl text-sm leading-6 text-slate-600">{plan.summary || "No summary provided."}</p>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                {project ? (
                  <Link
                    href={`/projects/${plan.projectId}/tasks/${plan.taskId}`}
                    className="font-medium text-sky-700 transition hover:text-sky-900 focus:outline-none focus:ring-3 focus:ring-sky-100"
                  >
                    Task #{plan.taskId}
                  </Link>
                ) : (
                  <span className="text-slate-500">Task #{plan.taskId}</span>
                )}
                <span className="break-all font-mono text-slate-600">{plan.filePath}</span>
                {project ? (
                  <Link
                    href={taskConsoleHref(plan.id)}
                    className="font-medium text-sky-700 transition hover:text-sky-900 focus:outline-none focus:ring-3 focus:ring-sky-100"
                  >
                    Execute task
                  </Link>
                ) : (
                  <span aria-disabled="true" className="text-slate-400">Execute task</span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default async function PlansPage(props: PageProps<"/plans">) {
  const searchParams = await props.searchParams;
  const requestedPage = Array.isArray(searchParams.page) ? searchParams.page[0] : searchParams.page;
  const requestedProjectId = Array.isArray(searchParams.project) ? searchParams.project[0] : searchParams.project;
  const parsedPage = requestedPage ? Number.parseInt(requestedPage, 10) : Number.NaN;
  const page = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;

  let projects: { id: string; name: string; color?: string }[] = [];
  let projectNames = new Map<string, { name: string; color?: string }>();
  let planPage: Awaited<ReturnType<typeof listAllPlans>> | undefined;
  let hasAnyPlans = false;
  let selectedProjectId = "";
  let error = "";

  try {
    const savedProjects = await listProjects();
    projects = savedProjects.map(({ id, name, color }) => ({ id, name, color }));
    projectNames = new Map(projects.map((project) => [project.id, { name: project.name, color: project.color }]));
    selectedProjectId = projects.some((project) => project.id === requestedProjectId) ? requestedProjectId ?? "" : "";
    planPage = await listAllPlans({ page, pageSize: PLANS_PAGE_SIZE, projectId: selectedProjectId || undefined });
    hasAnyPlans = (await listAllPlans({ page: 1, pageSize: 1 })).total > 0;
  } catch (caughtError) {
    console.error("Unable to render plans", caughtError);
    error = caughtError instanceof ProjectStoreError
      ? "Project data could not be read. Check data/projects.json and reload this page."
      : caughtError instanceof PlanStoreError
        ? "Plan data could not be read. Check data/plans.json and reload this page."
        : "Plans could not be loaded. Reload this page and try again.";
  }

  return (
    <main className="min-h-screen bg-[#f4f6fa] px-4 py-6 text-slate-900 sm:px-6 sm:py-10">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <header className="border-b border-slate-200 pb-5">
          <BrandBar />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-3xl font-semibold tracking-[-0.03em]">Plans</h1>
              <p className="mt-1 text-sm leading-6 text-slate-600">Plans registered after task planning sessions.</p>
            </div>
            <Link
              href={newPlanHref(selectedProjectId)}
              className="inline-flex h-11 items-center rounded-xl bg-sky-700 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-800 focus:outline-none focus:ring-3 focus:ring-sky-200"
            >
              New plan
            </Link>
          </div>
        </header>

        {error ? (
          <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
        ) : planPage && (
          <>
            <ProjectFilter projects={projects} selectedProjectId={selectedProjectId} />
            {planPage.total === 0 ? (
              <section className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
                <h2 className="text-lg font-semibold text-slate-900">{hasAnyPlans ? "No plans for this project" : "No plans yet"}</h2>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">
                  {hasAnyPlans ? <>Switch the project filter to see plans from other projects, or <Link href={newPlanHref(selectedProjectId)} className="font-medium text-sky-700 underline decoration-sky-300 underline-offset-2 hover:text-sky-900">register a plan by hand</Link>.</> : <>Plans appear here after a planning session finishes, or <Link href={newPlanHref(selectedProjectId)} className="font-medium text-sky-700 underline decoration-sky-300 underline-offset-2 hover:text-sky-900">register one by hand</Link>.</>}
                </p>
              </section>
            ) : (
              <>
                {planPage.plans.length > 0 ? <PlanRows plans={planPage.plans} projectNames={projectNames} /> : (
                  <p className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">There are no plans on this page.</p>
                )}
                <nav aria-label="Plan pagination" className="flex flex-wrap items-center justify-between gap-3">
                  {planPage.page > 1 ? (
                    <Link href={plansHref({ projectId: selectedProjectId, page: planPage.page - 1 })} className="h-11 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium leading-none text-slate-800 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-3 focus:ring-sky-100">Previous</Link>
                  ) : <span aria-disabled="true" className="h-11 rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm font-medium leading-none text-slate-400">Previous</span>}
                  <p className="text-sm text-slate-600">Page {planPage.page} of {planPage.totalPages}</p>
                  {planPage.page < planPage.totalPages ? (
                    <Link href={plansHref({ projectId: selectedProjectId, page: planPage.page + 1 })} className="h-11 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium leading-none text-slate-800 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-3 focus:ring-sky-100">Next</Link>
                  ) : <span aria-disabled="true" className="h-11 rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm font-medium leading-none text-slate-400">Next</span>}
                </nav>
              </>
            )}
          </>
        )}
      </div>
    </main>
  );
}
