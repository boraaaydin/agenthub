import Link from "next/link";

import { BrandLink } from "../brand-link";
import { ProjectFilter } from "./project-filter";
import { listProjects, ProjectStoreError } from "@/lib/projects-store";
import {
  listAllTasks,
  TaskStoreError,
  TASKS_PAGE_SIZE,
  type Task,
} from "@/lib/tasks-store";
import { planConsoleHref } from "@/lib/task-plan";

export const dynamic = "force-dynamic";

function taskPreview(detail: string): string {
  const normalized = detail.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "No detail provided.";
  }
  return normalized.length > 160 ? `${normalized.slice(0, 157)}…` : normalized;
}

function taskDate(value: string): string {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(value));
}

function TaskRows({ projectNames, tasks }: { projectNames: Map<string, string>; tasks: Task[] }) {
  return (
    <section aria-label="All tasks" className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <ul className="divide-y divide-slate-200">
        {tasks.map((task) => {
          const projectName = projectNames.get(task.projectId);
          const row = (
            <>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between sm:gap-5">
                <div className="flex min-w-0 items-baseline gap-2">
                  <span className="shrink-0 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                    {projectName ?? "Unknown project"}
                  </span>
                  <span className="shrink-0 text-sm font-medium tabular-nums text-slate-500">#{task.id}</span>
                  <h2 className="min-w-0 break-words font-medium text-slate-900">{task.title}</h2>
                </div>
                <time className="shrink-0 text-sm text-slate-500" dateTime={task.createdAt}>
                  {taskDate(task.createdAt)}
                </time>
              </div>
              <p className="mt-1.5 max-w-3xl text-sm leading-6 text-slate-600">{taskPreview(task.detail)}</p>
            </>
          );

          return (
            <li key={task.id} className="relative">
              {projectName ? (
                <>
                  <Link
                    href={`/projects/${task.projectId}/tasks/${task.id}`}
                    className="block px-4 py-4 transition hover:bg-slate-50 focus:outline-none focus:ring-3 focus:ring-inset focus:ring-sky-100 after:absolute after:inset-0 sm:px-5 sm:pr-36"
                  >
                    {row}
                  </Link>
                  <div className="relative z-10 px-4 pb-4 sm:absolute sm:right-5 sm:top-4 sm:px-0 sm:pb-0">
                    <Link
                      href={planConsoleHref(task.projectId, task.id)}
                      className="inline-flex h-9 items-center rounded-lg border border-sky-200 bg-white px-3 text-sm font-medium text-sky-800 shadow-sm transition hover:border-sky-300 hover:bg-sky-50 focus:outline-none focus:ring-3 focus:ring-sky-100"
                    >
                      Create plan
                    </Link>
                  </div>
                </>
              ) : (
                <div className="px-4 py-4 sm:px-5">{row}</div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function paginationHref(page: number, projectId: string): string {
  const searchParams = new URLSearchParams();
  if (projectId) {
    searchParams.set("project", projectId);
  }
  searchParams.set("page", String(page));
  return `/tasks?${searchParams.toString()}`;
}

function newTaskHref(projectId: string): string {
  return projectId ? `/tasks/new?project=${encodeURIComponent(projectId)}` : "/tasks/new";
}

export default async function TasksPage(props: PageProps<"/tasks">) {
  const searchParams = await props.searchParams;
  const requestedPage = Array.isArray(searchParams.page) ? searchParams.page[0] : searchParams.page;
  const requestedProjectId = Array.isArray(searchParams.project) ? searchParams.project[0] : searchParams.project;
  const parsedPage = requestedPage ? Number.parseInt(requestedPage, 10) : Number.NaN;
  const page = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;

  let projects: { id: string; name: string }[] = [];
  let projectNames = new Map<string, string>();
  let taskPage: Awaited<ReturnType<typeof listAllTasks>> | undefined;
  let selectedProjectId = "";
  let error = "";

  try {
    const savedProjects = await listProjects();
    projects = savedProjects.map(({ id, name }) => ({ id, name }));
    projectNames = new Map(projects.map((project) => [project.id, project.name]));
    selectedProjectId = projects.some((project) => project.id === requestedProjectId) ? requestedProjectId ?? "" : "";
    taskPage = await listAllTasks({
      page,
      pageSize: TASKS_PAGE_SIZE,
      projectId: selectedProjectId || undefined,
    });
  } catch (caughtError) {
    console.error("Unable to render tasks", caughtError);
    error = caughtError instanceof ProjectStoreError
      ? "Project data could not be read. Check data/projects.json and reload this page."
      : caughtError instanceof TaskStoreError
        ? "Task data could not be read. Check data/tasks.json and reload this page."
        : "Tasks could not be loaded. Reload this page and try again.";
  }

  return (
    <main className="min-h-screen bg-[#f4f6fa] px-4 py-6 text-slate-900 sm:px-6 sm:py-10">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <BrandLink />
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.03em]">Tasks</h1>
            <p className="mt-1 text-sm leading-6 text-slate-600">Every task across your saved projects.</p>
          </div>
          <Link
            href={newTaskHref(selectedProjectId)}
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
            <ProjectFilter projects={projects} selectedProjectId={selectedProjectId} />
            {taskPage.total === 0 ? (
              <section className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
                <h2 className="text-lg font-semibold text-slate-900">
                  {selectedProjectId ? "No tasks for this project" : "No tasks yet"}
                </h2>
                {selectedProjectId ? (
                  <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">
                    <Link
                      href={newTaskHref(selectedProjectId)}
                      className="font-medium text-sky-700 transition hover:text-sky-900 focus:outline-none focus:ring-3 focus:ring-sky-100"
                    >
                      Create a task for this project
                    </Link>
                    {" or "}
                    <Link
                      href="/tasks"
                      className="font-medium text-sky-700 transition hover:text-sky-900 focus:outline-none focus:ring-3 focus:ring-sky-100"
                    >
                      view all projects’ tasks
                    </Link>
                    .
                  </p>
                ) : (
                  <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">
                    <Link
                      href="/tasks/new"
                      className="font-medium text-sky-700 transition hover:text-sky-900 focus:outline-none focus:ring-3 focus:ring-sky-100"
                    >
                      Create your first task
                    </Link>
                    {" to keep work visible across your projects."}
                  </p>
                )}
              </section>
            ) : (
              <>
                {taskPage.tasks.length > 0 ? (
                  <TaskRows projectNames={projectNames} tasks={taskPage.tasks} />
                ) : (
                  <p className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
                    There are no tasks on this page.
                  </p>
                )}
                <nav aria-label="Task pagination" className="flex flex-wrap items-center justify-between gap-3">
                  {taskPage.page > 1 ? (
                    <Link
                      href={paginationHref(taskPage.page - 1, selectedProjectId)}
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
                      href={paginationHref(taskPage.page + 1, selectedProjectId)}
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
