"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import { BrandBar } from "../../brand-bar";
import { WorkitemDependencyPicker } from "../workitem-dependency-picker";
import { workitemsHref, type WorkitemDependency, type WorkitemFilterStatus } from "@/lib/workitem-filters";

type Project = {
  id: string;
  name: string;
};

type ApiError = { error?: string };

const EXCLUDED_DEPENDENCY_STATUSES = ["completed", "cancelled"] as const;

type NewWorkitemFormProps = {
  projects: Project[];
  initialProjectId: string;
  initialStatus: WorkitemFilterStatus;
  error: string;
};

export function NewWorkitemForm({ projects, initialProjectId, initialStatus, error: loadError }: NewWorkitemFormProps) {
  const router = useRouter();
  const [projectId, setProjectId] = useState(initialProjectId);
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [dependencies, setDependencies] = useState<WorkitemDependency[]>([]);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const workitemListPath = workitemsHref({ projectId, status: initialStatus });

  async function createWorkitem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!projectId) {
      setError("Choose a project.");
      return;
    }
    if (!title.trim()) {
      setError("Enter a workitem title.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/workitems`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          detail,
          dependencyIds: dependencies.map((dependency) => dependency.id),
        }),
      });
      const body = (await response.json()) as ApiError;

      if (!response.ok) {
        setError(body.error ?? "Unable to create the workitem. Try again.");
        return;
      }

      router.replace(workitemsHref({ projectId, status: initialStatus }));
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
          <BrandBar />
          <div className="mt-3">
            <Link
              href={workitemListPath}
              className="text-sm font-medium text-sky-700 transition hover:text-sky-900 focus:outline-none focus:ring-3 focus:ring-sky-100"
            >
              Workitems
            </Link>
          </div>
          <h1 className="mt-4 text-3xl font-semibold tracking-[-0.03em]">New workitem</h1>
          <p className="mt-1 text-sm leading-6 text-slate-600">Add work to a project&apos;s workitem list.</p>
        </header>

        {loadError ? (
          <p role="alert" className="mt-8 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {loadError}
          </p>
        ) : projects.length === 0 ? (
          <section className="mt-8 rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
            <h2 className="text-lg font-semibold text-slate-900">A project is required</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">
              Create a project before adding its first workitem.
            </p>
            <Link
              href="/projects/new"
              className="mt-5 inline-flex h-11 items-center rounded-xl bg-sky-700 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-800 focus:outline-none focus:ring-3 focus:ring-sky-200"
            >
              New project
            </Link>
          </section>
        ) : (
          <form onSubmit={createWorkitem} className="mt-8 space-y-6" noValidate>
            <div>
              <label className="block text-sm font-medium text-slate-800" htmlFor="workitem-project">Project</label>
              <select
                id="workitem-project"
                value={projectId}
                onChange={(event) => {
                  setProjectId(event.target.value);
                  setDependencies([]);
                }}
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
              <label className="block text-sm font-medium text-slate-800" htmlFor="workitem-title">Workitem title</label>
              <input
                id="workitem-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                autoComplete="off"
                disabled={isSubmitting}
                className="mt-2 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-sky-600 focus:ring-3 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                placeholder="Review the agent workflow"
              />
            </div>

            <WorkitemDependencyPicker
              projectId={projectId}
              selectedDependencies={dependencies}
              onChange={setDependencies}
              excludedStatuses={EXCLUDED_DEPENDENCY_STATUSES}
              disabled={isSubmitting}
            />

            <div>
              <label className="block text-sm font-medium text-slate-800" htmlFor="workitem-detail">Detail</label>
              <textarea
                id="workitem-detail"
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
                {isSubmitting ? "Creating workitem…" : "Create workitem"}
              </button>
              <Link
                href={workitemListPath}
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
