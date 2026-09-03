import Link from "next/link";

import { BrandBar } from "../brand-bar";
import { ProjectChip, UnknownProjectChip } from "../project-chip";
import { ProjectFilter } from "./project-filter";
import { StatusFilter } from "./status-filter";
import { TaskStatusButton } from "./task-status-button";
import { listProjects, ProjectStoreError } from "@/lib/projects-store";
import {
  listAllTasks,
  TaskStoreError,
  TASKS_PAGE_SIZE,
  type Task,
} from "@/lib/tasks-store";
import {
  ACTIVE_TASK_STATUSES,
  newTaskHref,
  taskFilterStatus,
  taskStatusBadgeClass,
  TASK_STATUS_LABELS,
  tasksHref,
} from "@/lib/task-filters";
import { planDetailHref, planStatusBadgeClass, planStatusLabel } from "@/lib/plan-filters";
import { listLatestPlansByTask, planTaskKey, type LatestPlansByTask } from "@/lib/plans-store";
import { planConsoleHref } from "@/lib/task-plan";

export const dynamic = "force-dynamic";

function taskDate(value: string): string {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(value));
}

function TaskRows({
  projectNames,
  tasks,
  plansByTask,
}: {
  projectNames: Map<string, { name: string; color?: string }>;
  tasks: Task[];
  plansByTask: LatestPlansByTask;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table aria-label="All tasks" className="w-full min-w-[860px] border-collapse text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-600">
            <tr>
              <th scope="col" className="px-4 py-3 sm:px-5">Project</th>
              <th scope="col" className="px-4 py-3 text-right sm:px-5">#</th>
              <th scope="col" className="min-w-56 px-4 py-3 sm:px-5">Title</th>
              <th scope="col" className="px-4 py-3 sm:px-5">Status</th>
              <th scope="col" className="px-4 py-3 sm:px-5">Plan</th>
              <th scope="col" className="px-4 py-3 whitespace-nowrap sm:px-5">Created</th>
              <th scope="col" className="px-4 py-3 sm:px-5">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {tasks.map((task) => {
              const project = projectNames.get(task.projectId);
              const planInfo = plansByTask.get(planTaskKey(task.projectId, task.id));
              const titleClass = `break-words font-medium ${task.status === "completed" ? "text-slate-500" : "text-slate-900"}`;

              return (
                <tr key={task.id} className="transition-colors hover:bg-slate-50">
                  <td className="px-4 py-4 align-top sm:px-5">
                    {project ? (
                      <ProjectChip projectId={task.projectId} name={project.name} color={project.color} />
                    ) : <UnknownProjectChip />}
                  </td>
                  <td className="px-4 py-4 text-right align-top font-medium tabular-nums text-slate-500 sm:px-5">#{task.id}</td>
                  <td className="px-4 py-4 align-top sm:px-5">
                    {project ? (
                      <Link
                        href={`/projects/${task.projectId}/tasks/${task.id}`}
                        className={`${titleClass} transition hover:text-sky-800 focus:outline-none focus:ring-3 focus:ring-sky-100`}
                      >
                        {task.title}
                      </Link>
                    ) : (
                      <span className={titleClass}>{task.title}</span>
                    )}
                  </td>
                  <td className="px-4 py-4 align-top sm:px-5">
                    <span className={`inline-block rounded-md px-2 py-0.5 text-xs font-medium ${taskStatusBadgeClass(task.status)}`}>
                      {TASK_STATUS_LABELS[task.status]}
                    </span>
                  </td>
                  <td className="px-4 py-4 align-top sm:px-5">
                    {planInfo ? (
                      <div className="flex items-center gap-1.5">
                        <Link
                          href={planDetailHref(planInfo.plan.id)}
                          className={`inline-block rounded-md px-2 py-0.5 text-xs font-medium transition hover:opacity-80 focus:outline-none focus:ring-3 focus:ring-sky-100 ${planStatusBadgeClass(planInfo.plan.status)}`}
                        >
                          {planStatusLabel(planInfo.plan.status)}
                        </Link>
                        {planInfo.planCount > 1 && (
                          <span className="text-xs text-slate-400">+{planInfo.planCount - 1}</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-4 align-top whitespace-nowrap text-slate-500 sm:px-5">
                    <time dateTime={task.createdAt}>{taskDate(task.createdAt)}</time>
                  </td>
                  <td className="px-4 py-4 align-top sm:px-5">
                    {project && (
                      <div className="flex flex-wrap gap-2">
                        <TaskStatusButton projectId={task.projectId} taskId={task.id} status={task.status} />
                        <Link
                          href={planConsoleHref(task.projectId, task.id)}
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
  let plansByTask: LatestPlansByTask = new Map();
  let error = "";

  try {
    const savedProjects = await listProjects();
    projects = savedProjects.map(({ id, name, color }) => ({ id, name, color }));
    projectNames = new Map(projects.map((project) => [project.id, { name: project.name, color: project.color }]));
    selectedProjectId = projects.some((project) => project.id === requestedProjectId) ? requestedProjectId ?? "" : "";
    taskPage = await listAllTasks({
      page,
      pageSize: TASKS_PAGE_SIZE,
      projectId: selectedProjectId || undefined,
      statuses: selectedStatus === "all"
        ? undefined
        : selectedStatus === "active"
          ? ACTIVE_TASK_STATUSES
          : [selectedStatus],
    });
    hasAnyTasks = (await listAllTasks({ page: 1, pageSize: 1 })).total > 0;
  } catch (caughtError) {
    console.error("Unable to render tasks", caughtError);
    error = caughtError instanceof ProjectStoreError
      ? "Project data could not be read. Check data/projects.json and reload this page."
      : caughtError instanceof TaskStoreError
        ? "Task data could not be read. Check data/tasks.json and reload this page."
        : "Tasks could not be loaded. Reload this page and try again.";
  }

  try {
    plansByTask = await listLatestPlansByTask();
  } catch (caughtError) {
    console.error("Unable to load task plan statuses", caughtError);
  }

  const filteredNewTaskHref = newTaskHref({ projectId: selectedProjectId, status: selectedStatus });
  const emptyTaskLabel = selectedStatus === "all"
    ? "No tasks"
    : selectedStatus === "active"
      ? "No active tasks"
      : `No ${TASK_STATUS_LABELS[selectedStatus].toLowerCase()} tasks`;

  return (
    <main className="min-h-screen bg-[#f4f6fa] px-4 py-6 text-slate-900 sm:px-6 sm:py-10">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <BrandBar />
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.03em]">Tasks</h1>
            <p className="mt-1 text-sm leading-6 text-slate-600">Every task across your saved projects.</p>
          </div>
          <Link
            href={filteredNewTaskHref}
            className="inline-flex h-11 items-center justify-center rounded-xl bg-sky-700 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-800 focus:outline-none focus:ring-3 focus:ring-sky-200"
          >
            New task
          </Link>
        </header>

        {error ? (
          <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </p>
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
                    <Link
                      href={filteredNewTaskHref}
                      className="font-medium text-sky-700 transition hover:text-sky-900 focus:outline-none focus:ring-3 focus:ring-sky-100"
                    >
                      Create your first task
                    </Link>
                    {" to keep work visible across your projects."}
                  </p>
                ) : selectedProjectId ? (
                  <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">
                    <Link
                      href={filteredNewTaskHref}
                      className="font-medium text-sky-700 transition hover:text-sky-900 focus:outline-none focus:ring-3 focus:ring-sky-100"
                    >
                      Create a task for this project
                    </Link>
                    {" or switch the filters to see other tasks."}
                  </p>
                ) : (
                  <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">
                    Switch the filters to see other tasks.
                  </p>
                )}
              </section>
            ) : (
              <>
                {taskPage.tasks.length > 0 ? (
                  <TaskRows projectNames={projectNames} tasks={taskPage.tasks} plansByTask={plansByTask} />
                ) : (
                  <p className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
                    There are no tasks on this page.
                  </p>
                )}
                <nav aria-label="Task pagination" className="flex flex-wrap items-center justify-between gap-3">
                  {taskPage.page > 1 ? (
                    <Link
                      href={tasksHref({ projectId: selectedProjectId, status: selectedStatus, page: taskPage.page - 1 })}
                      className="h-11 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium leading-none text-slate-800 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-3 focus:ring-sky-100"
                    >
                      Previous
                    </Link>
                  ) : (
                    <span aria-disabled="true" className="h-11 rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm font-medium leading-none text-slate-400">
                      Previous
                    </span>
                  )}
                  <p className="text-sm text-slate-600">Page {taskPage.page} of {taskPage.totalPages}</p>
                  {taskPage.page < taskPage.totalPages ? (
                    <Link
                      href={tasksHref({ projectId: selectedProjectId, status: selectedStatus, page: taskPage.page + 1 })}
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
