import Link from "next/link";

import { BrandBar } from "../brand-bar";
import { ProjectChip, UnknownProjectChip } from "../project-chip";
import {
  LIFECYCLE_LOG_PAGE_SIZE,
  LifecycleLogStoreError,
  listLifecycleEvents,
  logsHref,
  type LifecycleEvent,
} from "@/lib/lifecycle-log-store";
import { planDetailHref, planStatusBadgeClass, planStatusLabel } from "@/lib/task-filters";
import { getPlan } from "@/lib/tasks-store";
import { listProjects } from "@/lib/projects-store";
import { taskStatusBadgeClass, taskStatusLabel } from "@/lib/task-filters";
import { getTask } from "@/lib/tasks-store";

export const dynamic = "force-dynamic";

function eventDate(value: string): string {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function EntityLink({ event, exists }: { event: LifecycleEvent; exists: boolean }) {
  const label = `${event.entityType === "task" ? "Task" : "Plan"} #${event.entityId}`;
  if (!exists) {
    return <span className="font-medium tabular-nums text-slate-500">{label}</span>;
  }

  const href = event.entityType === "task"
    ? `/projects/${event.projectId}/tasks/${event.entityId}`
    : planDetailHref(event.entityId);
  return (
    <Link href={href} className="font-medium tabular-nums text-sky-700 transition hover:text-sky-900 focus:outline-none focus:ring-3 focus:ring-sky-100">
      {label}
    </Link>
  );
}

function Status({ event, field }: { event: LifecycleEvent; field: "fromStatus" | "toStatus" }) {
  if (event.entityType === "task") {
    const status = event[field];
    return status === null
      ? <span className="text-slate-400">—</span>
      : <span className={`inline-block rounded-md px-2 py-0.5 text-xs font-medium ${taskStatusBadgeClass(status)}`}>{taskStatusLabel(status)}</span>;
  }

  const status = event[field];
  return status === null
    ? <span className="text-slate-400">—</span>
    : <span className={`inline-block rounded-md px-2 py-0.5 text-xs font-medium ${planStatusBadgeClass(status)}`}>{planStatusLabel(status)}</span>;
}

function LogRows({
  events,
  projects,
  existingRecords,
}: {
  events: LifecycleEvent[];
  projects: Map<string, { name: string; color?: string }>;
  existingRecords: Set<string>;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table aria-label="Lifecycle log" className="w-full min-w-[820px] border-collapse text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-600">
            <tr>
              <th scope="col" className="px-4 py-3 whitespace-nowrap sm:px-5">Time</th>
              <th scope="col" className="px-4 py-3 sm:px-5">Project</th>
              <th scope="col" className="px-4 py-3 sm:px-5">Record</th>
              <th scope="col" className="px-4 py-3 sm:px-5">Previous status</th>
              <th scope="col" className="px-4 py-3 sm:px-5">New status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {events.map((event) => {
              const project = projects.get(event.projectId);
              const eventKey = `${event.entityType}:${event.entityId}:${event.projectId}`;
              return (
                <tr key={event.id} className="transition-colors hover:bg-slate-50">
                  <td className="px-4 py-4 align-top whitespace-nowrap text-slate-500 sm:px-5">
                    <time dateTime={event.createdAt}>{eventDate(event.createdAt)}</time>
                  </td>
                  <td className="px-4 py-4 align-top sm:px-5">
                    {project ? <ProjectChip projectId={event.projectId} name={project.name} color={project.color} /> : <UnknownProjectChip />}
                  </td>
                  <td className="px-4 py-4 align-top sm:px-5">
                    <EntityLink event={event} exists={existingRecords.has(eventKey) && (event.entityType === "plan" || Boolean(project))} />
                  </td>
                  <td className="px-4 py-4 align-top sm:px-5"><Status event={event} field="fromStatus" /></td>
                  <td className="px-4 py-4 align-top sm:px-5"><Status event={event} field="toStatus" /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

async function existingRecordKeys(events: LifecycleEvent[]): Promise<Set<string>> {
  const uniqueEvents = [...new Map(events.map((event) => [`${event.entityType}:${event.entityId}:${event.projectId}`, event])).values()];
  const results = await Promise.all(uniqueEvents.map(async (event) => {
    try {
      const exists = event.entityType === "task"
        ? Boolean(await getTask(event.projectId, event.entityId))
        : Boolean(await getPlan(event.entityId));
      return exists ? `${event.entityType}:${event.entityId}:${event.projectId}` : null;
    } catch (error) {
      console.error("Unable to resolve lifecycle log record", error);
      return null;
    }
  }));
  return new Set(results.filter((key): key is string => key !== null));
}

export default async function LogsPage(props: PageProps<"/logs">) {
  const searchParams = await props.searchParams;
  const requestedPage = Array.isArray(searchParams.page) ? searchParams.page[0] : searchParams.page;
  const parsedPage = requestedPage ? Number.parseInt(requestedPage, 10) : Number.NaN;
  const page = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;

  let logPage: Awaited<ReturnType<typeof listLifecycleEvents>> | undefined;
  let projects = new Map<string, { name: string; color?: string }>();
  let projectWarning = "";
  let error = "";

  try {
    logPage = await listLifecycleEvents({ page, pageSize: LIFECYCLE_LOG_PAGE_SIZE });
  } catch (caughtError) {
    console.error("Unable to render lifecycle log", caughtError);
    error = caughtError instanceof LifecycleLogStoreError
      ? "Lifecycle log data could not be read. Check data/lifecycle-log.json and reload this page."
      : "Lifecycle logs could not be loaded. Reload this page and try again.";
  }

  if (logPage) {
    try {
      const savedProjects = await listProjects();
      projects = new Map(savedProjects.map((project) => [project.id, { name: project.name, color: project.color }]));
    } catch (caughtError) {
      console.error("Unable to resolve lifecycle log projects", caughtError);
      projectWarning = "Project names are unavailable; log entries remain available.";
    }
  }

  const existingRecords = logPage ? await existingRecordKeys(logPage.events) : new Set<string>();

  return (
    <main className="min-h-screen bg-[#f4f6fa] px-4 py-6 text-slate-900 sm:px-6 sm:py-10">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <header className="border-b border-slate-200 pb-5">
          <BrandBar />
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.03em]">Logs</h1>
          <p className="mt-1 text-sm leading-6 text-slate-600">A persistent history of task and plan lifecycle changes.</p>
        </header>

        {error ? (
          <section aria-labelledby="logs-unavailable" className="rounded-xl border border-red-200 bg-red-50 px-6 py-8">
            <h2 id="logs-unavailable" className="text-lg font-semibold text-red-950">Logs unavailable</h2>
            <p role="alert" className="mt-2 text-sm leading-6 text-red-800">{error}</p>
          </section>
        ) : logPage && (
          <>
            {projectWarning && <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{projectWarning}</p>}
            {logPage.total === 0 ? (
              <section className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
                <h2 className="text-lg font-semibold text-slate-900">No lifecycle events yet</h2>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">New tasks and plans, and their future status changes, will appear here.</p>
              </section>
            ) : (
              <>
                {logPage.events.length > 0 ? <LogRows events={logPage.events} projects={projects} existingRecords={existingRecords} /> : (
                  <p className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">There are no lifecycle events on this page.</p>
                )}
                <nav aria-label="Lifecycle log pagination" className="flex flex-wrap items-center justify-between gap-3">
                  {logPage.page > 1 ? (
                    <Link href={logsHref(logPage.page - 1)} className="h-11 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium leading-none text-slate-800 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-3 focus:ring-sky-100">Previous</Link>
                  ) : <span aria-disabled="true" className="h-11 rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm font-medium leading-none text-slate-400">Previous</span>}
                  <p className="text-sm text-slate-600">Page {logPage.page} of {logPage.totalPages}</p>
                  {logPage.page < logPage.totalPages ? (
                    <Link href={logsHref(logPage.page + 1)} className="h-11 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium leading-none text-slate-800 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-3 focus:ring-sky-100">Next</Link>
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
