"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import { BrandLink } from "../../brand-link";
import { tasksHref, type TaskFilterStatus } from "@/lib/task-filters";

type Project = {
  id: string;
  name: string;
};

type ApiError = { error?: string };

type NewTaskFormProps = {
  projects: Project[];
  initialProjectId: string;
  initialStatus: TaskFilterStatus;
  error: string;
};

export function NewTaskForm({ projects, initialProjectId, initialStatus, error: loadError }: NewTaskFormProps) {
  const router = useRouter();
  const [projectId, setProjectId] = useState(initialProjectId);
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const taskListPath = tasksHref({ projectId, status: initialStatus });

  async function createTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!projectId) {
      setError("Choose a project.");
      return;
    }
    if (!title.trim()) {
      setError("Enter a task title.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, detail }),
      });
      const body = (await response.json()) as ApiError;

      if (!response.ok) {
        setError(body.error ?? "Unable to create the task. Try again.");
        return;
      }

      router.replace(tasksHref({ projectId, status: initialStatus }));
    } catch {
      setError("Unable to reach the server. Check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f4f6fa] px-4 py-6 text-slate-900 sm:px-6 sm:py-10">
      <div className="mx-auto w-full max-w-2xl">
        <header className="border-b border-slate-200 pb-5">
          <BrandLink />
          <div className="mt-3">
            <Link
              href={taskListPath}
              className="text-sm font-medium text-sky-700 transition hover:text-sky-900 focus:outline-none focus:ring-3 focus:ring-sky-100"
            >
              Tasks
            </Link>
          </div>
          <h1 className="mt-4 text-3xl font-semibold tracking-[-0.03em]">New task</h1>
          <p className="mt-1 text-sm leading-6 text-slate-600">Add work to a project&apos;s task list.</p>
        </header>

        {loadError ? (
          <p role="alert" className="mt-8 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {loadError}
          </p>
        ) : projects.length === 0 ? (
          <section className="mt-8 rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
            <h2 className="text-lg font-semibold text-slate-900">A project is required</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">
              Create a project before adding its first task.
            </p>
            <Link
              href="/projects/new"
              className="mt-5 inline-flex h-11 items-center rounded-xl bg-sky-700 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-800 focus:outline-none focus:ring-3 focus:ring-sky-200"
            >
              New project
            </Link>
          </section>
        ) : (
          <form onSubmit={createTask} className="mt-8 space-y-6" noValidate>
            <div>
              <label className="block text-sm font-medium text-slate-800" htmlFor="task-project">Project</label>
              <select
                id="task-project"
                value={projectId}
                onChange={(event) => setProjectId(event.target.value)}
                disabled={isSubmitting}
                className="mt-2 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-sky-600 focus:ring-3 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100"
              >
                <option value="" disabled>Select a project</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>{project.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-800" htmlFor="task-title">Task title</label>
              <input
                id="task-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                autoComplete="off"
                disabled={isSubmitting}
                className="mt-2 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-sky-600 focus:ring-3 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                placeholder="Review the agent workflow"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-800" htmlFor="task-detail">Detail</label>
              <textarea
                id="task-detail"
                value={detail}
                onChange={(event) => setDetail(event.target.value)}
                disabled={isSubmitting}
                rows={7}
                className="mt-2 w-full resize-y rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm leading-6 outline-none transition focus:border-sky-600 focus:ring-3 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                placeholder="Add useful context, notes, or acceptance criteria."
              />
            </div>

            {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="h-11 rounded-xl bg-sky-700 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-800 focus:outline-none focus:ring-3 focus:ring-sky-200 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {isSubmitting ? "Creating task…" : "Create task"}
              </button>
              <Link
                href={taskListPath}
                className="h-11 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium leading-none text-slate-800 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-3 focus:ring-sky-100"
              >
                Cancel
              </Link>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}
