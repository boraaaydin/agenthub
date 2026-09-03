import Link from "next/link";

import { BrandBar } from "../brand-bar";
import { ProjectChip, UnknownProjectChip } from "../project-chip";
import { ProjectFilter } from "./project-filter";
import { StatusFilter } from "./status-filter";
import { listProjects, ProjectStoreError } from "@/lib/projects-store";
import {
  ACTIVE_TASK_STATUSES,
  newTaskHref,
  taskDetailHref,
  taskFilterStatus,
  taskStatusBadgeClass,
  taskStatusLabel,
  TASK_STATUS_LABELS,
  tasksHref,
} from "@/lib/task-filters";
import { listAllTasks, taskTaskKey, TaskStoreError, PLANS_PAGE_SIZE, type Task } from "@/lib/tasks-store";
import { TERMINAL_TASK_STATUSES } from "@/lib/task-filters";
import { listTasksByStatuses, TaskStoreError } from "@/lib/tasks-store";
import { taskConsoleHref } from "@/lib/task-execution";

export const dynamic = "force-dynamic";

function taskDate(value: string): string {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(value));
}

function TaskRows({ tasks, projectNames }: { tasks: Task[]; projectNames: Map<string, { name: string; color?: string }> }) {
  return (
    <section aria-label="All tasks" className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <ul className="divide-y divide-slate-200">
        {tasks.map((task) => {
          const project = projectNames.get(task.projectId);
          return (
            <li key={task.id} className="px-4 py-4 sm:px-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between sm:gap-5">
                <div className="flex min-w-0 flex-wrap items-baseline gap-2">
                  {project ? (
                    <ProjectChip projectId={task.projectId} name={project.name} color={project.color} />
                  ) : <UnknownProjectChip />}
                  <span className="shrink-0 text-sm font-medium tabular-nums text-slate-500">#{task.id}</span>
                  <span className={`inline-block rounded-md px-2 py-0.5 text-xs font-medium ${taskStatusBadgeClass(task.status)}`}>
                    {taskStatusLabel(task.status)}
                  </span>
                  <h2 className="min-w-0 break-words font-medium text-slate-900">
                    <Link href={taskDetailHref(task.id)} className="transition hover:text-sky-800 focus:outline-none focus:ring-3 focus:ring-sky-100">
                      {task.title}
                    </Link>
                  </h2>
                </div>
                <time className="shrink-0 text-sm text-slate-500" dateTime={task.createdAt}>{taskDate(task.createdAt)}</time>
              </div>
              <p className="mt-1.5 max-w-3xl text-sm leading-6 text-slate-600">{task.summary || "No summary provided."}</p>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                {project ? (
                  <Link
                    href={`/projects/${task.projectId}/tasks/${task.taskId}`}
                    className="font-medium text-sky-700 transition hover:text-sky-900 focus:outline-none focus:ring-3 focus:ring-sky-100"
                  >
                    Task #{task.taskId}
                  </Link>
                ) : (
                  <span className="text-slate-500">Task #{task.taskId}</span>
                )}
                <span className="break-all font-mono text-slate-600">{task.filePath}</span>
                {project ? (
                  <Link
                    href={taskConsoleHref(task.id)}
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

export default async function TasksPage(props: PageProps<"/tasks">) {
  const searchParams = await props.searchParams;
  const requestedPage = Array.isArray(searchParams.page) ? searchParams.page[0] : searchParams.page;
  const requestedProjectId = Array.isArray(searchParams.project) ? searchParams.project[0] : searchParams.project;
  const requestedStatus = Array.isArray(searchParams.status) ? searchParams.status[0] : searchParams.status;
  const requestedAll = Array.isArray(searchParams.all) ? searchParams.all[0] : searchParams.all;
  const parsedPage = requestedPage ? Number.parseInt(requestedPage, 10) : Number.NaN;
  const page = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const selectedStatus = taskFilterStatus(requestedStatus, requestedAll);

  let projects: { id: string; name: string; color?: string }[] = [];
  let projectNames = new Map<string, { name: string; color?: string }>();
  let taskPage: Awaited<ReturnType<typeof listAllTasks>> | undefined;
  let hasAnyTasks = false;
  let selectedProjectId = "";
  let error = "";

  try {
    const savedProjects = await listProjects();
    projects = savedProjects.map(({ id, name, color }) => ({ id, name, color }));
    projectNames = new Map(projects.map((project) => [project.id, { name: project.name, color: project.color }]));
    selectedProjectId = projects.some((project) => project.id === requestedProjectId) ? requestedProjectId ?? "" : "";
    const excludedTaskKeys = selectedStatus === "all"
      ? undefined
      : new Set((await listTasksByStatuses(TERMINAL_TASK_STATUSES)).map((task) => taskTaskKey(task.projectId, task.id)));
    taskPage = await listAllTasks({
      page,
      pageSize: PLANS_PAGE_SIZE,
      projectId: selectedProjectId || undefined,
      statuses: selectedStatus === "all"
        ? undefined
        : selectedStatus === "active"
          ? ACTIVE_TASK_STATUSES
          : [selectedStatus],
      excludedTaskKeys,
    });
    hasAnyTasks = (await listAllTasks({ page: 1, pageSize: 1 })).total > 0;
  } catch (caughtError) {
    console.error("Unable to render tasks", caughtError);
    error = caughtError instanceof ProjectStoreError
      ? "Project data could not be read. Check data/projects.json and reload this page."
      : caughtError instanceof TaskStoreError
        ? "Task data could not be read. Check data/tasks.json and reload this page."
        : caughtError instanceof TaskStoreError
          ? "Task data could not be read. Check data/tasks.json and reload this page."
          : "Tasks could not be loaded. Reload this page and try again.";
  }

  const emptyTaskLabel = selectedStatus === "all"
    ? "No tasks"
    : selectedStatus === "active"
      ? "No active tasks"
      : `No ${TASK_STATUS_LABELS[selectedStatus].toLowerCase()} tasks`;

  return (
    <main className="min-h-screen bg-[#f4f6fa] px-4 py-6 text-slate-900 sm:px-6 sm:py-10">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <header className="border-b border-slate-200 pb-5">
          <BrandBar />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-3xl font-semibold tracking-[-0.03em]">Tasks</h1>
              <p className="mt-1 text-sm leading-6 text-slate-600">Tasks registered after task taskning sessions.</p>
            </div>
            <Link
              href={newTaskHref(selectedProjectId)}
              className="inline-flex h-11 items-center rounded-xl bg-sky-700 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-800 focus:outline-none focus:ring-3 focus:ring-sky-200"
            >
              New task
            </Link>
          </div>
        </header>

        {error ? (
          <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
        ) : taskPage && (
          <>
            <div className="flex flex-col gap-4 sm:flex-row sm:gap-5">
              <ProjectFilter projects={projects} selectedProjectId={selectedProjectId} selectedStatus={selectedStatus} />
              <StatusFilter projectId={selectedProjectId} selectedStatus={selectedStatus} />
            </div>
            {taskPage.total === 0 ? (
              <section className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
                <h2 className="text-lg font-semibold text-slate-900">
                  {!hasAnyTasks ? "No tasks yet" : selectedProjectId ? `${emptyTaskLabel} for this project` : emptyTaskLabel}
                </h2>
                {!hasAnyTasks ? (
                  <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">
                    Tasks appear here after a taskning session finishes, or <Link href={newTaskHref(selectedProjectId)} className="font-medium text-sky-700 underline decoration-sky-300 underline-offset-2 hover:text-sky-900">register one by hand</Link>.
                  </p>
                ) : selectedProjectId ? (
                  <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">
                    <Link href={newTaskHref(selectedProjectId)} className="font-medium text-sky-700 underline decoration-sky-300 underline-offset-2 hover:text-sky-900">Register a task for this project</Link> or switch the filters to see other tasks.
                  </p>
                ) : (
                  <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">
                    Switch the filters to see other tasks.
                  </p>
                )}
              </section>
            ) : (
              <>
                {taskPage.tasks.length > 0 ? <TaskRows tasks={taskPage.tasks} projectNames={projectNames} /> : (
                  <p className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">There are no tasks on this page.</p>
                )}
                <nav aria-label="Task pagination" className="flex flex-wrap items-center justify-between gap-3">
                  {taskPage.page > 1 ? (
                    <Link href={tasksHref({ projectId: selectedProjectId, status: selectedStatus, page: taskPage.page - 1 })} className="h-11 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium leading-none text-slate-800 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-3 focus:ring-sky-100">Previous</Link>
                  ) : <span aria-disabled="true" className="h-11 rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm font-medium leading-none text-slate-400">Previous</span>}
                  <p className="text-sm text-slate-600">Page {taskPage.page} of {taskPage.totalPages}</p>
                  {taskPage.page < taskPage.totalPages ? (
                    <Link href={tasksHref({ projectId: selectedProjectId, status: selectedStatus, page: taskPage.page + 1 })} className="h-11 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium leading-none text-slate-800 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-3 focus:ring-sky-100">Next</Link>
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
