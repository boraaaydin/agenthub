"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import { BrandLink } from "../../../../brand-link";
import { planConsoleHref } from "@/lib/task-plan";

type Task = {
  id: number;
  projectId: string;
  title: string;
  detail: string;
  createdAt: string;
  updatedAt: string;
};

type ApiError = { error?: string };

type TaskDetailProps = {
  projectName: string;
  task: Task;
};

export default function TaskDetail({ projectName, task }: TaskDetailProps) {
  const router = useRouter();
  const taskListPath = `/projects/${task.projectId}/tasks`;
  const taskApiPath = `/api/projects/${task.projectId}/tasks/${task.id}`;
  const [title, setTitle] = useState(task.title);
  const [detail, setDetail] = useState(task.detail);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleteConfirming, setIsDeleteConfirming] = useState(false);

  function resetForm() {
    setTitle(task.title);
    setDetail(task.detail);
    setError("");
    setStatus("");
  }

  async function saveTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setStatus("");

    if (!title.trim()) {
      setError("Enter a task title.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(taskApiPath, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, detail }),
      });
      const body = (await response.json()) as Task | ApiError;

      if (!response.ok) {
        setError((body as ApiError).error ?? "Unable to save changes. Try again.");
        return;
      }

      const updatedTask = body as Task;
      setTitle(updatedTask.title);
      setDetail(updatedTask.detail);
      setStatus("Changes saved.");
      router.refresh();
    } catch {
      setError("Unable to reach the server. Check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function deleteTask() {
    setError("");
    setStatus("");
    setIsSubmitting(true);

    try {
      const response = await fetch(taskApiPath, { method: "DELETE" });
      const body = (await response.json()) as ApiError;

      if (!response.ok) {
        setError(body.error ?? "Unable to delete the task. Try again.");
        return;
      }

      router.replace(taskListPath);
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
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Link
              href={taskListPath}
              className="text-sm font-medium text-sky-700 transition hover:text-sky-900 focus:outline-none focus:ring-3 focus:ring-sky-100"
            >
              {projectName} tasks
            </Link>
            <span className="text-sm text-slate-500">Task #{task.id}</span>
          </div>
          <h1 className="mt-4 break-words text-3xl font-semibold tracking-[-0.03em]">{task.title}</h1>
          <p className="mt-1 text-sm leading-6 text-slate-600">Update this task&apos;s title and detail.</p>
          <Link
            href={planConsoleHref(task.projectId, task.id)}
            className="mt-4 inline-flex h-10 items-center rounded-xl border border-sky-200 bg-white px-4 text-sm font-medium text-sky-800 shadow-sm transition hover:border-sky-300 hover:bg-sky-50 focus:outline-none focus:ring-3 focus:ring-sky-100"
          >
            Create plan
          </Link>
        </header>

        <form onSubmit={saveTask} className="mt-8 space-y-6" noValidate>
          <div>
            <label className="block text-sm font-medium text-slate-800" htmlFor="task-title">Task title</label>
            <input
              id="task-title"
              value={title}
              onChange={(event) => {
                setTitle(event.target.value);
                setStatus("");
              }}
              autoComplete="off"
              disabled={isSubmitting}
              className="mt-2 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-sky-600 focus:ring-3 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-800" htmlFor="task-detail">Detail</label>
            <textarea
              id="task-detail"
              value={detail}
              onChange={(event) => {
                setDetail(event.target.value);
                setStatus("");
              }}
              disabled={isSubmitting}
              rows={9}
              className="mt-2 w-full resize-y rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm leading-6 outline-none transition focus:border-sky-600 focus:ring-3 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100"
            />
          </div>

          {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
          {status && <p role="status" className="text-sm text-emerald-700">{status}</p>}

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="h-11 rounded-xl bg-sky-700 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-800 focus:outline-none focus:ring-3 focus:ring-sky-200 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {isSubmitting ? "Saving changes…" : "Save changes"}
            </button>
            <button
              type="button"
              onClick={resetForm}
              disabled={isSubmitting}
              className="h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm font-medium text-slate-800 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-3 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100"
            >
              Cancel
            </button>
          </div>
        </form>

        <section className="mt-10 border-t border-slate-200 pt-6" aria-labelledby="delete-task">
          <h2 id="delete-task" className="text-sm font-semibold text-slate-900">Delete task</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">This permanently removes the task from this project&apos;s list.</p>
          {isDeleteConfirming ? (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={deleteTask}
                disabled={isSubmitting}
                className="h-11 rounded-xl bg-red-700 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-red-800 focus:outline-none focus:ring-3 focus:ring-red-200 disabled:cursor-not-allowed disabled:bg-red-300"
              >
                {isSubmitting ? "Deleting task…" : "Confirm delete"}
              </button>
              <button
                type="button"
                onClick={() => setIsDeleteConfirming(false)}
                disabled={isSubmitting}
                className="h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm font-medium text-slate-800 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-3 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsDeleteConfirming(true)}
              disabled={isSubmitting}
              className="mt-4 h-11 rounded-xl border border-red-300 bg-white px-4 text-sm font-medium text-red-800 shadow-sm transition hover:border-red-400 hover:bg-red-50 focus:outline-none focus:ring-3 focus:ring-red-100 disabled:cursor-not-allowed disabled:bg-slate-100"
            >
              Delete task
            </button>
          )}
        </section>
      </div>
    </main>
  );
}
