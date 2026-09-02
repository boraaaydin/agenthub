"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

type ApiError = { error?: string };

export default function NewTaskPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function createTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!title.trim()) {
      setError("Enter a task title.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/projects/${id}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, detail }),
      });
      const body = (await response.json()) as ApiError;

      if (!response.ok) {
        setError(body.error ?? "Unable to create the task. Try again.");
        return;
      }

      router.replace(`/projects/${id}/tasks`);
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
          <Link
            href={`/projects/${id}/tasks`}
            className="text-sm font-medium text-sky-700 transition hover:text-sky-900 focus:outline-none focus:ring-3 focus:ring-sky-100"
          >
            Tasks
          </Link>
          <h1 className="mt-4 text-3xl font-semibold tracking-[-0.03em]">New task</h1>
          <p className="mt-1 text-sm leading-6 text-slate-600">Add work to this project&apos;s task list.</p>
        </header>

        <form onSubmit={createTask} className="mt-8 space-y-6" noValidate>
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
              href={`/projects/${id}/tasks`}
              className="h-11 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium leading-none text-slate-800 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-3 focus:ring-sky-100"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </main>
  );
}
