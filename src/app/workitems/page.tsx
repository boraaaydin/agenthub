import Link from "next/link";

import { BrandBar } from "../brand-bar";
import { ProjectChip, UnknownProjectChip } from "../project-chip";
import { ProjectFilter } from "./project-filter";
import { StatusFilter } from "./status-filter";
import { WorkitemLiveUpdates } from "./workitem-live-updates";
import { WorkitemStatusButton } from "./workitem-status-button";
import { listProjects, ProjectStoreError } from "@/lib/projects-store";
import {
  listAllWorkitems,
  WorkitemStoreError,
  WORKITEMS_PAGE_SIZE,
  type Workitem,
} from "@/lib/workitems-store";
import {
  ACTIVE_WORKITEM_STATUSES,
  newWorkitemHref,
  workitemFilterStatus,
  workitemStatusBadgeClass,
  WORKITEM_STATUS_LABELS,
  workitemsHref,
} from "@/lib/workitem-filters";
import { listLatestTasksByWorkitem, taskWorkitemKey, type LatestTasksByWorkitem } from "@/lib/tasks-store";
import { planConsoleHref } from "@/lib/plan-prompt";
import { taskConsoleHref } from "@/lib/task-execution";

export const dynamic = "force-dynamic";

function workitemDate(value: string): string {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(value));
}

function WorkitemRows({
  projectNames,
  workitems,
  tasksByWorkitem,
}: {
  projectNames: Map<string, { name: string; color?: string }>;
  workitems: Workitem[];
  tasksByWorkitem: LatestTasksByWorkitem;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table aria-label="All workitems" className="w-full min-w-[860px] border-collapse text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-600">
            <tr>
              <th scope="col" className="px-4 py-3 sm:px-5">Project</th>
              <th scope="col" className="px-4 py-3 text-right sm:px-5">#</th>
              <th scope="col" className="min-w-56 px-4 py-3 sm:px-5">Title</th>
              <th scope="col" className="px-4 py-3 sm:px-5">Status</th>
              <th scope="col" className="px-4 py-3 whitespace-nowrap sm:px-5">Created</th>
              <th scope="col" className="px-4 py-3 sm:px-5">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {workitems.map((workitem) => {
              const project = projectNames.get(workitem.projectId);
              const taskInfo = tasksByWorkitem.get(taskWorkitemKey(workitem.projectId, workitem.id));
              const titleClass = `break-words font-medium ${workitem.status === "completed" ? "text-slate-500" : "text-slate-900"}`;

              return (
                <tr key={workitem.id} className="transition-colors hover:bg-slate-50">
                  <td className="px-4 py-4 align-top sm:px-5">
                    {project ? (
                      <ProjectChip projectId={workitem.projectId} name={project.name} color={project.color} />
                    ) : <UnknownProjectChip />}
                  </td>
                  <td className="px-4 py-4 text-right align-top font-medium tabular-nums text-slate-500 sm:px-5">#{workitem.id}</td>
                  <td className="px-4 py-4 align-top sm:px-5">
                    {project ? (
                      <Link
                        href={`/projects/${workitem.projectId}/workitems/${workitem.id}`}
                        className={`${titleClass} transition hover:text-sky-800 focus:outline-none focus:ring-3 focus:ring-sky-100`}
                      >
                        {workitem.title}
                      </Link>
                    ) : (
                      <span className={titleClass}>{workitem.title}</span>
                    )}
                  </td>
                  <td className="px-4 py-4 align-top sm:px-5">
                    <span className={`inline-block rounded-md px-2 py-0.5 text-xs font-medium ${workitemStatusBadgeClass(workitem.status)}`}>
                      {WORKITEM_STATUS_LABELS[workitem.status]}
                    </span>
                  </td>
                  <td className="px-4 py-4 align-top whitespace-nowrap text-slate-500 sm:px-5">
                    <time dateTime={workitem.createdAt}>{workitemDate(workitem.createdAt)}</time>
                  </td>
                  <td className="px-4 py-4 align-top sm:px-5">
                    {project && (
                      <div className="flex flex-wrap gap-2">
                        <WorkitemStatusButton projectId={workitem.projectId} workitemId={workitem.id} status={workitem.status} />
                        {workitem.status === "task_created" && taskInfo && (
                          <Link
                            href={taskConsoleHref(taskInfo.task.id)}
                            className="inline-flex h-9 items-center rounded-lg border border-sky-200 bg-white px-3 text-sm font-medium text-sky-800 shadow-sm transition hover:border-sky-300 hover:bg-sky-50 focus:outline-none focus:ring-3 focus:ring-sky-100"
                          >
                            Execute task
                          </Link>
                        )}
                        <Link
                          href={planConsoleHref(workitem.projectId, workitem.id)}
                          className="inline-flex h-9 items-center rounded-lg border border-sky-200 bg-white px-3 text-sm font-medium text-sky-800 shadow-sm transition hover:border-sky-300 hover:bg-sky-50 focus:outline-none focus:ring-3 focus:ring-sky-100"
                        >
                          Create plan
                        </Link>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default async function WorkitemsPage(props: PageProps<"/workitems">) {
  const searchParams = await props.searchParams;
  const requestedPage = Array.isArray(searchParams.page) ? searchParams.page[0] : searchParams.page;
  const requestedProjectId = Array.isArray(searchParams.project) ? searchParams.project[0] : searchParams.project;
  const requestedStatus = Array.isArray(searchParams.status) ? searchParams.status[0] : searchParams.status;
  const requestedAll = Array.isArray(searchParams.all) ? searchParams.all[0] : searchParams.all;
  const parsedPage = requestedPage ? Number.parseInt(requestedPage, 10) : Number.NaN;
  const page = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const selectedStatus = workitemFilterStatus(requestedStatus, requestedAll);

  let projects: { id: string; name: string; color?: string }[] = [];
  let projectNames = new Map<string, { name: string; color?: string }>();
  let workitemPage: Awaited<ReturnType<typeof listAllWorkitems>> | undefined;
  let hasAnyWorkitems = false;
  let selectedProjectId = "";
  let tasksByWorkitem: LatestTasksByWorkitem = new Map();
  let error = "";

  try {
    const savedProjects = await listProjects();
    projects = savedProjects.map(({ id, name, color }) => ({ id, name, color }));
    projectNames = new Map(projects.map((project) => [project.id, { name: project.name, color: project.color }]));
    selectedProjectId = projects.some((project) => project.id === requestedProjectId) ? requestedProjectId ?? "" : "";
    workitemPage = await listAllWorkitems({
      page,
      pageSize: WORKITEMS_PAGE_SIZE,
      projectId: selectedProjectId || undefined,
      statuses: selectedStatus === "all"
        ? undefined
        : selectedStatus === "active"
          ? ACTIVE_WORKITEM_STATUSES
          : [selectedStatus],
    });
    hasAnyWorkitems = (await listAllWorkitems({ page: 1, pageSize: 1 })).total > 0;
  } catch (caughtError) {
    console.error("Unable to render workitems", caughtError);
    error = caughtError instanceof ProjectStoreError
      ? "Project data could not be read. Check data/projects.json and reload this page."
      : caughtError instanceof WorkitemStoreError
        ? "Workitem data could not be read. Check data/workitems.json and reload this page."
        : "Workitems could not be loaded. Reload this page and try again.";
  }

  try {
    tasksByWorkitem = await listLatestTasksByWorkitem();
  } catch (caughtError) {
    console.error("Unable to load workitem plan statuses", caughtError);
  }

  const filteredNewWorkitemHref = newWorkitemHref({ projectId: selectedProjectId, status: selectedStatus });
  const emptyWorkitemLabel = selectedStatus === "all"
    ? "No workitems"
    : selectedStatus === "active"
      ? "No active workitems"
      : `No ${WORKITEM_STATUS_LABELS[selectedStatus].toLowerCase()} workitems`;

  return (
    <main className="min-h-screen bg-[#f4f6fa] px-4 py-6 text-slate-900 sm:px-6 sm:py-10">
      <WorkitemLiveUpdates />
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <BrandBar />
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.03em]">Workitems</h1>
            <p className="mt-1 text-sm leading-6 text-slate-600">Every workitem across your saved projects.</p>
          </div>
          <Link
            href={filteredNewWorkitemHref}
            className="inline-flex h-11 items-center justify-center rounded-xl bg-sky-700 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-800 focus:outline-none focus:ring-3 focus:ring-sky-200"
          >
            New workitem
          </Link>
        </header>

        {error ? (
          <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </p>
        ) : workitemPage && (
          <>
            <div className="flex flex-col gap-4 sm:flex-row sm:gap-5">
              <ProjectFilter projects={projects} selectedProjectId={selectedProjectId} selectedStatus={selectedStatus} />
              <StatusFilter projectId={selectedProjectId} selectedStatus={selectedStatus} />
            </div>
            {workitemPage.total === 0 ? (
              <section className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
                <h2 className="text-lg font-semibold text-slate-900">
                  {!hasAnyWorkitems ? "No workitems yet" : selectedProjectId ? `${emptyWorkitemLabel} for this project` : emptyWorkitemLabel}
                </h2>
                {!hasAnyWorkitems ? (
                  <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">
                    <Link
                      href={filteredNewWorkitemHref}
                      className="font-medium text-sky-700 transition hover:text-sky-900 focus:outline-none focus:ring-3 focus:ring-sky-100"
                    >
                      Create your first workitem
                    </Link>
                    {" to keep work visible across your projects."}
                  </p>
                ) : selectedProjectId ? (
                  <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">
                    <Link
                      href={filteredNewWorkitemHref}
                      className="font-medium text-sky-700 transition hover:text-sky-900 focus:outline-none focus:ring-3 focus:ring-sky-100"
                    >
                      Create a workitem for this project
                    </Link>
                    {" or switch the filters to see other workitems."}
                  </p>
                ) : (
                  <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">
                    Switch the filters to see other workitems.
                  </p>
                )}
              </section>
            ) : (
              <>
                {workitemPage.workitems.length > 0 ? (
                  <WorkitemRows projectNames={projectNames} workitems={workitemPage.workitems} tasksByWorkitem={tasksByWorkitem} />
                ) : (
                  <p className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
                    There are no workitems on this page.
                  </p>
                )}
                <nav aria-label="Workitem pagination" className="flex flex-wrap items-center justify-between gap-3">
                  {workitemPage.page > 1 ? (
                    <Link
                      href={workitemsHref({ projectId: selectedProjectId, status: selectedStatus, page: workitemPage.page - 1 })}
                      className="h-11 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium leading-none text-slate-800 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-3 focus:ring-sky-100"
                    >
                      Previous
                    </Link>
                  ) : (
                    <span aria-disabled="true" className="h-11 rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm font-medium leading-none text-slate-400">
                      Previous
                    </span>
                  )}
                  <p className="text-sm text-slate-600">Page {workitemPage.page} of {workitemPage.totalPages}</p>
                  {workitemPage.page < workitemPage.totalPages ? (
                    <Link
                      href={workitemsHref({ projectId: selectedProjectId, status: selectedStatus, page: workitemPage.page + 1 })}
                      className="h-11 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium leading-none text-slate-800 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-3 focus:ring-sky-100"
                    >
                      Next
                    </Link>
                  ) : (
                    <span aria-disabled="true" className="h-11 rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm font-medium leading-none text-slate-400">
                      Next
                    </span>
                  )}
                </nav>
              </>
            )}
          </>
        )}
      </div>
    </main>
  );
}
