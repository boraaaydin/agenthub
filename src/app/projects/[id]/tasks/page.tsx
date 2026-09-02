import Link from "next/link";
import { notFound } from "next/navigation";

import { BrandLink } from "../../../brand-link";
import { getProject, ProjectStoreError } from "@/lib/projects-store";
import {
  listProjectTasks,
  TaskStoreError,
  TASKS_PAGE_SIZE,
  type Task,
} from "@/lib/tasks-store";

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

function TaskRows({ projectId, tasks }: { projectId: string; tasks: Task[] }) {
  return (
    <section aria-label="Project tasks" className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <ul className="divide-y divide-slate-200">
        {tasks.map((task) => (
          <li key={task.id}>
            <Link
              href={`/projects/${projectId}/tasks/${task.id}`}
              className="block px-4 py-4 transition hover:bg-slate-50 focus:outline-none focus:ring-3 focus:ring-inset focus:ring-sky-100 sm:px-5"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between sm:gap-5">
                <h2 className="min-w-0 break-words font-medium text-slate-900">{task.title}</h2>
                <time className="shrink-0 text-sm text-slate-500" dateTime={task.createdAt}>
                  {taskDate(task.createdAt)}
                </time>
              </div>
              <p className="mt-1.5 max-w-3xl text-sm leading-6 text-slate-600">{taskPreview(task.detail)}</p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default async function ProjectTasksPage(props: PageProps<"/projects/[id]/tasks">) {
  const { id } = await props.params;
  const searchParams = await props.searchParams;
  const requestedPage = Array.isArray(searchParams.page) ? searchParams.page[0] : searchParams.page;
  const parsedPage = requestedPage ? Number.parseInt(requestedPage, 10) : Number.NaN;
  const page = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;

  let project;
  let taskPage;
  let error = "";

  try {
    project = await getProject(id);
    if (project) {
      taskPage = await listProjectTasks(id, { page, pageSize: TASKS_PAGE_SIZE });
    }
  } catch (caughtError) {
    console.error("Unable to render project tasks", caughtError);
    error = caughtError instanceof ProjectStoreError
      ? "Project data could not be read. Check data/projects.json and reload this page."
      : caughtError instanceof TaskStoreError
        ? "Task data could not be read. Check data/tasks.json and reload this page."
        : "Tasks could not be loaded. Reload this page and try again.";
  }

  if (!error && !project) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-[#f4f6fa] px-4 py-6 text-slate-900 sm:px-6 sm:py-10">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <BrandLink />
            <div className="mt-3">
              <Link
                href={project ? `/projects/${project.id}` : "/"}
                className="text-sm font-medium text-sky-700 transition hover:text-sky-900 focus:outline-none focus:ring-3 focus:ring-sky-100"
              >
                {project ? project.name : "Projects"}
              </Link>
            </div>
            <h1 className="mt-4 break-words text-3xl font-semibold tracking-[-0.03em]">Tasks</h1>
            <p className="mt-1 text-sm leading-6 text-slate-600">Keep track of work for this project.</p>
          </div>
          {project && (
            <Link
              href={`/projects/${project.id}/tasks/new`}
              className="inline-flex h-11 items-center justify-center rounded-xl bg-sky-700 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-800 focus:outline-none focus:ring-3 focus:ring-sky-200"
            >
              New task
            </Link>
          )}
        </header>

        {error ? (
          <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </p>
        ) : taskPage && taskPage.total === 0 ? (
          <section className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
            <h2 className="text-lg font-semibold text-slate-900">No tasks yet</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">
              Add a task to keep the next piece of work visible for this project.
            </p>
            <Link
              href={`/projects/${id}/tasks/new`}
              className="mt-5 inline-flex h-11 items-center rounded-xl bg-sky-700 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-800 focus:outline-none focus:ring-3 focus:ring-sky-200"
            >
              New task
            </Link>
          </section>
        ) : taskPage && (
          <>
            {taskPage.tasks.length > 0 ? (
              <TaskRows projectId={id} tasks={taskPage.tasks} />
            ) : (
              <p className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
                There are no tasks on this page.
              </p>
            )}
            <nav aria-label="Task pagination" className="flex flex-wrap items-center justify-between gap-3">
              {taskPage.page > 1 ? (
                <Link
                  href={`?page=${taskPage.page - 1}`}
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
                  href={`?page=${taskPage.page + 1}`}
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
      </div>
    </main>
  );
}
