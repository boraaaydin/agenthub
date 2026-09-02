"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import { BrandBar } from "../../brand-bar";
import { DeletePlanSection } from "./delete-plan-section";
import { PlanFilePreview } from "./plan-file-preview";

type Plan = {
  id: number;
  projectId: string;
  taskId: number;
  title: string;
  filePath: string;
  summary: string;
  createdAt: string;
  updatedAt: string;
};

type Project = { id: string; name: string };
type Task = { id: number; title: string };
type ApiError = { error?: string };

type PlanDetailProps = {
  plan: Plan;
  projects: Project[];
  tasksByProject: Record<string, Task[]>;
  taskExists: boolean;
  filePreview: React.ComponentProps<typeof PlanFilePreview>["result"];
  projectPath: string | null;
};

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default function PlanDetail({ plan, projects, tasksByProject, taskExists, filePreview, projectPath }: PlanDetailProps) {
  const router = useRouter();
  const [currentPlan, setCurrentPlan] = useState(plan);
  const [projectId, setProjectId] = useState(plan.projectId);
  const [taskId, setTaskId] = useState(String(plan.taskId));
  const [title, setTitle] = useState(plan.title);
  const [filePath, setFilePath] = useState(plan.filePath);
  const [summary, setSummary] = useState(plan.summary);
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const apiPath = `/api/plans/${currentPlan.id}`;
  const currentProject = projects.find((project) => project.id === currentPlan.projectId);
  const currentTaskExists = taskExists && currentPlan.projectId === plan.projectId && currentPlan.taskId === plan.taskId
    ? true
    : Boolean(tasksByProject[currentPlan.projectId]?.some((task) => task.id === currentPlan.taskId));
  const availableTasks = tasksByProject[projectId] ?? [];

  function resetForm() {
    setProjectId(plan.projectId);
    setTaskId(String(plan.taskId));
    setTitle(plan.title);
    setFilePath(plan.filePath);
    setSummary(plan.summary);
    setError("");
    setStatusMessage("");
  }

  function changeProject(nextProjectId: string) {
    setProjectId(nextProjectId);
    if (!tasksByProject[nextProjectId]?.some((task) => task.id === Number(taskId))) {
      setTaskId("");
    }
    setStatusMessage("");
  }

  async function savePlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setStatusMessage("");
    if (!title.trim()) {
      setError("Enter a plan title.");
      return;
    }
    if (!filePath.trim()) {
      setError("Enter a plan file path.");
      return;
    }
    if (!projectId) {
      setError("Choose a project.");
      return;
    }
    if (!taskId) {
      setError("Choose a task.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(apiPath, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, taskId, title, filePath, summary }),
      });
      const body = (await response.json()) as Plan | ApiError;
      if (!response.ok) {
        setError((body as ApiError).error ?? "Unable to save changes. Try again.");
        return;
      }
      const updatedPlan = body as Plan;
      setCurrentPlan(updatedPlan);
      setProjectId(updatedPlan.projectId);
      setTaskId(String(updatedPlan.taskId));
      setTitle(updatedPlan.title);
      setFilePath(updatedPlan.filePath);
      setSummary(updatedPlan.summary);
      setStatusMessage("Changes saved.");
      router.refresh();
    } catch {
      setError("Unable to reach the server. Check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleDeleted(fileError?: string) {
    if (fileError) {
      setStatusMessage(`Plan record deleted, but the file was not: ${fileError} Redirecting to plans…`);
      window.setTimeout(() => router.replace("/plans"), 1200);
      return;
    }
    router.replace("/plans");
  }

  return (
    <main className="min-h-screen bg-[#f4f6fa] px-4 py-6 text-slate-900 sm:px-6 sm:py-10">
      <div className="mx-auto w-full max-w-3xl">
        <header className="border-b border-slate-200 pb-5">
          <BrandBar />
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <Link href="/plans" className="font-medium text-sky-700 transition hover:text-sky-900 focus:outline-none focus:ring-3 focus:ring-sky-100">Plans</Link>
            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">Plan #{currentPlan.id}</span>
          </div>
          <h1 className="mt-4 break-words text-3xl font-semibold tracking-[-0.03em]">{currentPlan.title}</h1>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm text-slate-600">
            <span>{currentProject?.name ?? "Unknown project"}</span>
            {currentProject && currentTaskExists ? (
              <Link href={`/projects/${currentPlan.projectId}/tasks/${currentPlan.taskId}`} className="font-medium text-sky-700 transition hover:text-sky-900 focus:outline-none focus:ring-3 focus:ring-sky-100">Task #{currentPlan.taskId}</Link>
            ) : <span>Task #{currentPlan.taskId}</span>}
          </div>
          <p className="mt-2 text-sm text-slate-500">Created {formatDate(currentPlan.createdAt)} · Updated {formatDate(currentPlan.updatedAt)}</p>
        </header>

        <form onSubmit={savePlan} className="mt-8 space-y-6" noValidate>
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-800" htmlFor="plan-project">Project</label>
              <select id="plan-project" value={projectId} onChange={(event) => changeProject(event.target.value)} disabled={isSubmitting} className="mt-2 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-sky-600 focus:ring-3 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100">
                <option value="" disabled>Select a project</option>
                {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-800" htmlFor="plan-task">Task</label>
              <select id="plan-task" value={taskId} onChange={(event) => { setTaskId(event.target.value); setStatusMessage(""); }} disabled={isSubmitting || !projectId} className="mt-2 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-sky-600 focus:ring-3 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100">
                <option value="" disabled>{projectId ? "Select a task" : "Select a project first"}</option>
                {availableTasks.map((task) => <option key={task.id} value={task.id}>#{task.id} · {task.title}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-800" htmlFor="plan-title">Plan title</label>
            <input id="plan-title" value={title} onChange={(event) => { setTitle(event.target.value); setStatusMessage(""); }} autoComplete="off" disabled={isSubmitting} className="mt-2 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-sky-600 focus:ring-3 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-800" htmlFor="plan-file-path">Plan file path</label>
            <input id="plan-file-path" value={filePath} onChange={(event) => { setFilePath(event.target.value); setStatusMessage(""); }} autoComplete="off" disabled={isSubmitting} className="mt-2 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 font-mono text-sm outline-none transition focus:border-sky-600 focus:ring-3 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-800" htmlFor="plan-summary">Summary</label>
            <textarea id="plan-summary" value={summary} onChange={(event) => { setSummary(event.target.value); setStatusMessage(""); }} disabled={isSubmitting} rows={6} className="mt-2 w-full resize-y rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm leading-6 outline-none transition focus:border-sky-600 focus:ring-3 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100" />
          </div>
          {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
          {statusMessage && <p role="status" className="text-sm text-emerald-700">{statusMessage}</p>}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button type="submit" disabled={isSubmitting} className="h-11 rounded-xl bg-sky-700 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-800 focus:outline-none focus:ring-3 focus:ring-sky-200 disabled:cursor-not-allowed disabled:bg-slate-300">{isSubmitting ? "Saving changes…" : "Save changes"}</button>
            <button type="button" onClick={resetForm} disabled={isSubmitting} className="h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm font-medium text-slate-800 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-3 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100">Cancel</button>
          </div>
        </form>

        <PlanFilePreview filePath={currentPlan.filePath} projectPath={projectPath} result={filePreview} />
        <DeletePlanSection apiPath={apiPath} filePath={currentPlan.filePath} disabled={isSubmitting} onError={setError} onDeleted={handleDeleted} />
      </div>
    </main>
  );
}
