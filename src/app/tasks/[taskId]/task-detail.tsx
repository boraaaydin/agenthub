"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useRef, useState } from "react";

import { BrandBar } from "../../brand-bar";
import { ProjectChip, UnknownProjectChip } from "../../project-chip";
import { DeleteTaskSection } from "./delete-task-section";
import { TaskFilePreview } from "./task-file-preview";
import {
  TASK_STATUSES,
  TASK_STATUS_LABELS,
  taskStatusBadgeClass,
  taskStatusLabel,
  type TaskStatus,
} from "@/lib/task-filters";

type Task = {
  id: number;
  projectId: string;
  taskId: number;
  title: string;
  filePath: string;
  summary: string;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
};

type Project = { id: string; name: string; color?: string };
type Task = { id: number; title: string };
type ApiError = { error?: string };

type TaskDetailProps = {
  task: Task;
  projects: Project[];
  tasksByProject: Record<string, Task[]>;
  taskExists: boolean;
  filePreview: React.ComponentProps<typeof TaskFilePreview>["result"];
  projectPath: string | null;
};

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default function TaskDetail({ task, projects, tasksByProject, taskExists, filePreview, projectPath }: TaskDetailProps) {
  const router = useRouter();
  const [currentTask, setCurrentTask] = useState(task);
  const [projectId, setProjectId] = useState(task.projectId);
  const [taskId, setTaskId] = useState(String(task.taskId));
  const [title, setTitle] = useState(task.title);
  const [filePath, setFilePath] = useState(task.filePath);
  const [summary, setSummary] = useState(task.summary);
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<TaskStatus | null>(null);
  const mountedRef = useRef(true);
  const statusControllerRef = useRef<AbortController | null>(null);
  const apiPath = `/api/tasks/${currentTask.id}`;
  const currentProject = projects.find((project) => project.id === currentTask.projectId);
  const currentTaskExists = taskExists && currentTask.projectId === task.projectId && currentTask.taskId === task.taskId
    ? true
    : Boolean(tasksByProject[currentTask.projectId]?.some((task) => task.id === currentTask.taskId));
  const availableTasks = tasksByProject[projectId] ?? [];

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      statusControllerRef.current?.abort();
    };
  }, []);

  function resetForm() {
    setProjectId(task.projectId);
    setTaskId(String(task.taskId));
    setTitle(task.title);
    setFilePath(task.filePath);
    setSummary(task.summary);
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

  async function saveTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setStatusMessage("");
    if (!title.trim()) {
      setError("Enter a task title.");
      return;
    }
    if (!filePath.trim()) {
      setError("Enter a task file path.");
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
      const body = (await response.json()) as Task | ApiError;
      if (!response.ok) {
        setError((body as ApiError).error ?? "Unable to save changes. Try again.");
        return;
      }
      const updatedTask = body as Task;
      setCurrentTask((current) => ({ ...updatedTask, status: current.status }));
      setProjectId(updatedTask.projectId);
      setTaskId(String(updatedTask.taskId));
      setTitle(updatedTask.title);
      setFilePath(updatedTask.filePath);
      setSummary(updatedTask.summary);
      setStatusMessage("Changes saved.");
      router.refresh();
    } catch {
      setError("Unable to reach the server. Check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function updateTaskStatus(status: TaskStatus) {
    if (status === currentTask.status || statusControllerRef.current) {
      return;
    }

    const controller = new AbortController();
    statusControllerRef.current = controller;
    setPendingStatus(status);
    setIsUpdatingStatus(true);
    setError("");
    setStatusMessage("");

    let receivedResponse = false;
    try {
      const response = await fetch(apiPath, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
        signal: controller.signal,
      });
      receivedResponse = true;
      let body: Task | ApiError = {};
      try {
        body = (await response.json()) as Task | ApiError;
      } catch {
        // A non-JSON error response still receives the standard actionable fallback.
      }
      if (!response.ok) {
        throw new Error((body as ApiError).error ?? "Unable to update the task status. Try again.");
      }

      const updatedTask = body as Task;
      if (mountedRef.current) {
        setCurrentTask((current) => ({
          ...current,
          status: updatedTask.status,
          updatedAt: updatedTask.updatedAt,
        }));
        setPendingStatus(null);
        setStatusMessage(`Task status updated to ${taskStatusLabel(updatedTask.status)}.`);
        router.refresh();
      }
    } catch (caughtError) {
      if (!controller.signal.aborted && mountedRef.current) {
        setPendingStatus(null);
        setError(receivedResponse && caughtError instanceof Error
          ? caughtError.message
          : "Unable to reach the server. Check your connection and try again.");
      }
    } finally {
      if (statusControllerRef.current === controller) {
        statusControllerRef.current = null;
      }
      if (mountedRef.current) {
        setIsUpdatingStatus(false);
      }
    }
  }

  function handleDeleted(fileError?: string) {
    if (fileError) {
      setStatusMessage(`Task record deleted, but the file was not: ${fileError} Redirecting to tasks…`);
      window.setTimeout(() => router.replace("/tasks"), 1200);
      return;
    }
    router.replace("/tasks");
  }

  return (
    <main className="min-h-screen bg-[#f4f6fa] px-4 py-6 text-slate-900 sm:px-6 sm:py-10">
      <div className="mx-auto w-full max-w-3xl">
        <header className="border-b border-slate-200 pb-5">
          <BrandBar />
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <Link href="/tasks" className="font-medium text-sky-700 transition hover:text-sky-900 focus:outline-none focus:ring-3 focus:ring-sky-100">Tasks</Link>
            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">Task #{currentTask.id}</span>
            <span className={`inline-block rounded-md px-2 py-0.5 text-xs font-medium ${taskStatusBadgeClass(currentTask.status)}`}>
              {taskStatusLabel(currentTask.status)}
            </span>
          </div>
          <h1 className="mt-4 break-words text-3xl font-semibold tracking-[-0.03em]">{currentTask.title}</h1>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm text-slate-600">
            {currentProject ? (
              <ProjectChip projectId={currentProject.id} name={currentProject.name} color={currentProject.color} />
            ) : <UnknownProjectChip />}
            {currentProject && currentTaskExists ? (
              <Link href={`/projects/${currentTask.projectId}/tasks/${currentTask.taskId}`} className="font-medium text-sky-700 transition hover:text-sky-900 focus:outline-none focus:ring-3 focus:ring-sky-100">Task #{currentTask.taskId}</Link>
            ) : <span>Task #{currentTask.taskId}</span>}
          </div>
          <p className="mt-2 text-sm text-slate-500">Created {formatDate(currentTask.createdAt)} · Updated {formatDate(currentTask.updatedAt)}</p>
          <div className="mt-4 max-w-xs">
            <label className="block text-sm font-medium text-slate-800" htmlFor="task-status">Task status</label>
            <select
              id="task-status"
              value={pendingStatus ?? currentTask.status}
              onChange={(event) => { void updateTaskStatus(event.target.value as TaskStatus); }}
              disabled={isUpdatingStatus || isSubmitting}
              aria-describedby={isUpdatingStatus ? "task-status-progress" : undefined}
              className="mt-2 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-sky-600 focus:ring-3 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100"
            >
              {TASK_STATUSES.map((status) => <option key={status} value={status}>{TASK_STATUS_LABELS[status]}</option>)}
            </select>
            {isUpdatingStatus && <p id="task-status-progress" role="status" className="mt-2 text-sm text-slate-600">Updating status…</p>}
          </div>
        </header>

        <form onSubmit={saveTask} className="mt-8 space-y-6" noValidate>
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-800" htmlFor="task-project">Project</label>
              <select id="task-project" value={projectId} onChange={(event) => changeProject(event.target.value)} disabled={isSubmitting} className="mt-2 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-sky-600 focus:ring-3 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100">
                <option value="" disabled>Select a project</option>
                {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-800" htmlFor="task-task">Task</label>
              <select id="task-task" value={taskId} onChange={(event) => { setTaskId(event.target.value); setStatusMessage(""); }} disabled={isSubmitting || !projectId} className="mt-2 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-sky-600 focus:ring-3 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100">
                <option value="" disabled>{projectId ? "Select a task" : "Select a project first"}</option>
                {availableTasks.map((task) => <option key={task.id} value={task.id}>#{task.id} · {task.title}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-800" htmlFor="task-title">Task title</label>
            <input id="task-title" value={title} onChange={(event) => { setTitle(event.target.value); setStatusMessage(""); }} autoComplete="off" disabled={isSubmitting} className="mt-2 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-sky-600 focus:ring-3 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-800" htmlFor="task-file-path">Task file path</label>
            <input id="task-file-path" value={filePath} onChange={(event) => { setFilePath(event.target.value); setStatusMessage(""); }} autoComplete="off" disabled={isSubmitting} className="mt-2 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 font-mono text-sm outline-none transition focus:border-sky-600 focus:ring-3 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-800" htmlFor="task-summary">Summary</label>
            <textarea id="task-summary" value={summary} onChange={(event) => { setSummary(event.target.value); setStatusMessage(""); }} disabled={isSubmitting} rows={6} className="mt-2 w-full resize-y rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm leading-6 outline-none transition focus:border-sky-600 focus:ring-3 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100" />
          </div>
          {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
          {statusMessage && <p role="status" className="text-sm text-emerald-700">{statusMessage}</p>}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button type="submit" disabled={isSubmitting} className="h-11 rounded-xl bg-sky-700 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-800 focus:outline-none focus:ring-3 focus:ring-sky-200 disabled:cursor-not-allowed disabled:bg-slate-300">{isSubmitting ? "Saving changes…" : "Save changes"}</button>
            <button type="button" onClick={resetForm} disabled={isSubmitting} className="h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm font-medium text-slate-800 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-3 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100">Cancel</button>
          </div>
        </form>

        <TaskFilePreview filePath={currentTask.filePath} projectPath={projectPath} result={filePreview} />
        <DeleteTaskSection apiPath={apiPath} filePath={currentTask.filePath} disabled={isSubmitting} onError={setError} onDeleted={handleDeleted} />
      </div>
    </main>
  );
}
