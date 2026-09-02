"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import { BrandBar } from "../../brand-bar";
import { planDetailHref, plansHref } from "@/lib/plan-filters";

type Project = { id: string; name: string };
type Task = { id: number; title: string };
type ApiResponse = { id: number; error?: string };

type NewPlanFormProps = {
  projects: Project[];
  tasksByProject: Record<string, Task[]>;
  initialProjectId: string;
  error: string;
};

export function NewPlanForm({ projects, tasksByProject, initialProjectId, error: loadError }: NewPlanFormProps) {
  const router = useRouter();
  const [projectId, setProjectId] = useState(initialProjectId);
  const [taskId, setTaskId] = useState("");
  const [title, setTitle] = useState("");
  const [filePath, setFilePath] = useState("");
  const [summary, setSummary] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const availableTasks = tasksByProject[projectId] ?? [];
  const plansPath = plansHref({ projectId });

  function changeProject(nextProjectId: string) {
    setProjectId(nextProjectId);
    setTaskId("");
    setError("");
  }

  async function createPlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!projectId) {
      setError("Choose a project.");
      return;
    }
    if (!taskId) {
      setError("Choose a task.");
      return;
    }
    if (!title.trim()) {
      setError("Enter a plan title.");
      return;
    }
    if (!filePath.trim()) {
      setError("Enter a plan file path.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, taskId, title, filePath, summary }),
      });
      const body = (await response.json()) as ApiResponse;
      if (!response.ok) {
        setError(body.error ?? "Unable to create the plan. Try again.");
        return;
      }
      router.replace(planDetailHref(body.id));
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
          <div className="mt-3"><Link href={plansPath} className="text-sm font-medium text-sky-700 transition hover:text-sky-900 focus:outline-none focus:ring-3 focus:ring-sky-100">Plans</Link></div>
          <h1 className="mt-4 text-3xl font-semibold tracking-[-0.03em]">New plan</h1>
          <p className="mt-1 text-sm leading-6 text-slate-600">Register a plan file that was created outside a planning session.</p>
        </header>
        {loadError ? <p role="alert" className="mt-8 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{loadError}</p> : projects.length === 0 ? (
          <section className="mt-8 rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
            <h2 className="text-lg font-semibold text-slate-900">A project is required</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">Create a project before registering a plan.</p>
            <Link href="/projects/new" className="mt-5 inline-flex h-11 items-center rounded-xl bg-sky-700 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-800 focus:outline-none focus:ring-3 focus:ring-sky-200">New project</Link>
          </section>
        ) : (
          <form onSubmit={createPlan} className="mt-8 space-y-6" noValidate>
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-slate-800" htmlFor="new-plan-project">Project</label>
                <select id="new-plan-project" value={projectId} onChange={(event) => changeProject(event.target.value)} disabled={isSubmitting} className="mt-2 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-sky-600 focus:ring-3 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100">
                  <option value="" disabled>Select a project</option>
                  {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-800" htmlFor="new-plan-task">Task</label>
                <select id="new-plan-task" value={taskId} onChange={(event) => setTaskId(event.target.value)} disabled={isSubmitting || !projectId} className="mt-2 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-sky-600 focus:ring-3 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100">
                  <option value="" disabled>{projectId ? "Select a task" : "Select a project first"}</option>
                  {availableTasks.map((task) => <option key={task.id} value={task.id}>#{task.id} · {task.title}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-800" htmlFor="new-plan-title">Plan title</label>
              <input id="new-plan-title" value={title} onChange={(event) => setTitle(event.target.value)} autoComplete="off" disabled={isSubmitting} className="mt-2 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-sky-600 focus:ring-3 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100" placeholder="Implement session handoff" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-800" htmlFor="new-plan-file-path">Plan file path</label>
              <input id="new-plan-file-path" value={filePath} onChange={(event) => setFilePath(event.target.value)} autoComplete="off" disabled={isSubmitting} className="mt-2 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 font-mono text-sm outline-none transition focus:border-sky-600 focus:ring-3 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100" placeholder="docs/plans/session-handoff.md" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-800" htmlFor="new-plan-summary">Summary</label>
              <textarea id="new-plan-summary" value={summary} onChange={(event) => setSummary(event.target.value)} disabled={isSubmitting} rows={6} className="mt-2 w-full resize-y rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm leading-6 outline-none transition focus:border-sky-600 focus:ring-3 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100" placeholder="Add a brief description of the proposed work." />
            </div>
            {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button type="submit" disabled={isSubmitting} className="h-11 rounded-xl bg-sky-700 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-800 focus:outline-none focus:ring-3 focus:ring-sky-200 disabled:cursor-not-allowed disabled:bg-slate-300">{isSubmitting ? "Creating plan…" : "Create plan"}</button>
              <Link href={plansPath} className="h-11 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium leading-none text-slate-800 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-3 focus:ring-sky-100">Cancel</Link>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}
