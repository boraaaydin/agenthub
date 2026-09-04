"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import { BrandBar } from "../../brand-bar";
import { taskDetailHref, tasksHref } from "@/lib/task-filters";

type Project = { id: string; name: string };
type Application = { id: string; name: string };
type Workitem = { id: number; title: string };
type ApiResponse = { id: number; error?: string };

type NewTaskFormProps = {
  projects: Project[];
  applicationsByProject: Record<string, Application[]>;
  workitemsByProject: Record<string, Workitem[]>;
  initialProjectId: string;
  error: string;
};

export function NewTaskForm({
  projects,
  applicationsByProject,
  workitemsByProject,
  initialProjectId,
  error: loadError,
}: NewTaskFormProps) {
  const router = useRouter();
  const [projectId, setProjectId] = useState(initialProjectId);
  const [applicationId, setApplicationId] = useState("");
  const [workitemId, setWorkitemId] = useState("");
  const [title, setTitle] = useState("");
  const [filePath, setFilePath] = useState("");
  const [summary, setSummary] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const availableApplications = applicationsByProject[projectId] ?? [];
  const availableWorkitems = workitemsByProject[projectId] ?? [];
  const tasksPath = tasksHref({ projectId });

  function changeProject(nextProjectId: string) {
    setProjectId(nextProjectId);
    setApplicationId("");
    setWorkitemId("");
    setError("");
  }

  async function createTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!projectId) {
      setError("Choose a project.");
      return;
    }
    if (availableApplications.length === 0) {
      setError("Add an application to this project before registering a task.");
      return;
    }
    if (!applicationId) {
      setError("Choose an application.");
      return;
    }
    if (!workitemId) {
      setError("Choose a workitem.");
      return;
    }
    if (!title.trim()) {
      setError("Enter a task title.");
      return;
    }
    if (!filePath.trim()) {
      setError("Enter a task file path.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, applicationId, workitemId, title, filePath, summary }),
      });
      const body = (await response.json()) as ApiResponse;
      if (!response.ok) {
        setError(body.error ?? "Unable to create the task. Try again.");
        return;
      }
      router.replace(taskDetailHref(body.id));
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
          <div className="mt-3"><Link href={tasksPath} className="text-sm font-medium text-sky-700 transition hover:text-sky-900 focus:outline-none focus:ring-3 focus:ring-sky-100">Tasks</Link></div>
          <h1 className="mt-4 text-3xl font-semibold tracking-[-0.03em]">New task</h1>
          <p className="mt-1 text-sm leading-6 text-slate-600">Register a task file that was created outside a planning session.</p>
        </header>
        {loadError ? <p role="alert" className="mt-8 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{loadError}</p> : projects.length === 0 ? (
          <section className="mt-8 rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
            <h2 className="text-lg font-semibold text-slate-900">A project is required</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">Create a project before registering a task.</p>
            <Link href="/projects/new" className="mt-5 inline-flex h-11 items-center rounded-xl bg-sky-700 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-800 focus:outline-none focus:ring-3 focus:ring-sky-200">New project</Link>
          </section>
        ) : (
          <form onSubmit={createTask} className="mt-8 space-y-6" noValidate>
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-slate-800" htmlFor="new-task-project">Project</label>
                <select id="new-task-project" value={projectId} onChange={(event) => changeProject(event.target.value)} disabled={isSubmitting} className="mt-2 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-sky-600 focus:ring-3 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100">
                  <option value="" disabled>Select a project</option>
                  {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-800" htmlFor="new-task-application">Application</label>
                <select id="new-task-application" value={applicationId} onChange={(event) => setApplicationId(event.target.value)} disabled={isSubmitting || !projectId || availableApplications.length === 0} className="mt-2 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-sky-600 focus:ring-3 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100">
                  <option value="" disabled>{!projectId ? "Select a project first" : availableApplications.length ? "Select an application" : "No applications available"}</option>
                  {availableApplications.map((application) => <option key={application.id} value={application.id}>{application.name}</option>)}
                </select>
              </div>
            </div>
            {projectId && availableApplications.length === 0 && (
              <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                Add an application on the <Link href={`/projects/${projectId}`} className="font-medium underline decoration-amber-400 underline-offset-2">project page</Link> before registering a task.
              </p>
            )}
            <div>
              <label className="block text-sm font-medium text-slate-800" htmlFor="new-task-workitem">Workitem</label>
              <select id="new-task-workitem" value={workitemId} onChange={(event) => setWorkitemId(event.target.value)} disabled={isSubmitting || !projectId} className="mt-2 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-sky-600 focus:ring-3 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100">
                <option value="" disabled>{projectId ? "Select a workitem" : "Select a project first"}</option>
                {availableWorkitems.map((workitem) => <option key={workitem.id} value={workitem.id}>#{workitem.id} · {workitem.title}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-800" htmlFor="new-task-title">Task title</label>
              <input id="new-task-title" value={title} onChange={(event) => setTitle(event.target.value)} autoComplete="off" disabled={isSubmitting} className="mt-2 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-sky-600 focus:ring-3 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100" placeholder="Implement session handoff" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-800" htmlFor="new-task-file-path">Task file path</label>
              <input id="new-task-file-path" value={filePath} onChange={(event) => setFilePath(event.target.value)} autoComplete="off" disabled={isSubmitting} className="mt-2 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 font-mono text-sm outline-none transition focus:border-sky-600 focus:ring-3 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100" placeholder=".agent/tasks/session-handoff.md" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-800" htmlFor="new-task-summary">Summary</label>
              <textarea id="new-task-summary" value={summary} onChange={(event) => setSummary(event.target.value)} disabled={isSubmitting} rows={6} className="mt-2 w-full resize-y rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm leading-6 outline-none transition focus:border-sky-600 focus:ring-3 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100" placeholder="Add a brief description of the proposed work." />
            </div>
            {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button type="submit" disabled={isSubmitting || (Boolean(projectId) && availableApplications.length === 0)} className="h-11 rounded-xl bg-sky-700 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-800 focus:outline-none focus:ring-3 focus:ring-sky-200 disabled:cursor-not-allowed disabled:bg-slate-300">{isSubmitting ? "Creating task…" : "Create task"}</button>
              <Link href={tasksPath} className="h-11 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium leading-none text-slate-800 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-3 focus:ring-sky-100">Cancel</Link>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}
