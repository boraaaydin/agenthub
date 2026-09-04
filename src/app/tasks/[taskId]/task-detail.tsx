"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

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
  workitemId: number;
  title: string;
  filePath: string;
  summary: string;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
};

type Project = { id: string; name: string; color?: string };
type ApiError = { error?: string };

type TaskDetailProps = {
  task: Task;
  project: Project | null;
  filePreview: React.ComponentProps<typeof TaskFilePreview>["result"];
  projectPath: string | null;
};

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function TaskDetail({
  task,
  project,
  filePreview,
  projectPath,
}: TaskDetailProps) {
  const router = useRouter();
  const [currentTask, setCurrentTask] = useState(task);
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<TaskStatus | null>(null);
  const mountedRef = useRef(true);
  const statusControllerRef = useRef<AbortController | null>(null);
  const apiPath = `/api/tasks/${currentTask.id}`;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      statusControllerRef.current?.abort();
    };
  }, []);

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
        setError(
          receivedResponse && caughtError instanceof Error
            ? caughtError.message
            : "Unable to reach the server. Check your connection and try again.",
        );
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
      setStatusMessage(
        `Task record deleted, but the file was not: ${fileError} Redirecting to tasks…`,
      );
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
            <Link
              href="/tasks"
              className="font-medium text-sky-700 transition hover:text-sky-900 focus:outline-none focus:ring-3 focus:ring-sky-100"
            >
              Tasks
            </Link>
            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
              Task #{currentTask.id}
            </span>
            <span
              className={`inline-block rounded-md px-2 py-0.5 text-xs font-medium ${taskStatusBadgeClass(currentTask.status)}`}
            >
              {taskStatusLabel(currentTask.status)}
            </span>
          </div>
          <h1 className="mt-4 break-words text-3xl font-semibold tracking-[-0.03em]">
            {currentTask.title}
          </h1>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm text-slate-600">
            {project ? (
              <ProjectChip
                projectId={project.id}
                name={project.name}
                color={project.color}
              />
            ) : (
              <UnknownProjectChip />
            )}
            {project ? (
              <Link
                href={`/projects/${currentTask.projectId}/workitems/${currentTask.workitemId}`}
                className="font-medium text-sky-700 transition hover:text-sky-900 focus:outline-none focus:ring-3 focus:ring-sky-100"
              >
                Workitem #{currentTask.workitemId}
              </Link>
            ) : (
              <span>Workitem #{currentTask.workitemId}</span>
            )}
          </div>
          <p className="mt-2 text-sm text-slate-500">
            Created {formatDate(currentTask.createdAt)} · Updated {formatDate(currentTask.updatedAt)}
          </p>
          <div className="mt-4 max-w-xs">
            <label className="block text-sm font-medium text-slate-800" htmlFor="task-status">
              Task status
            </label>
            <select
              id="task-status"
              value={pendingStatus ?? currentTask.status}
              onChange={(event) => {
                void updateTaskStatus(event.target.value as TaskStatus);
              }}
              disabled={isUpdatingStatus}
              aria-describedby={isUpdatingStatus ? "task-status-progress" : undefined}
              className="mt-2 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-sky-600 focus:ring-3 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100"
            >
              {TASK_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {TASK_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
            {isUpdatingStatus && (
              <p
                id="task-status-progress"
                role="status"
                className="mt-2 text-sm text-slate-600"
              >
                Updating status…
              </p>
            )}
          </div>
        </header>

        {(error || statusMessage) && (
          <div className="mt-6 space-y-3">
            {error && (
              <p
                role="alert"
                className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
              >
                {error}
              </p>
            )}
            {statusMessage && (
              <p role="status" className="text-sm text-emerald-700">
                {statusMessage}
              </p>
            )}
          </div>
        )}

        <section
          className="mt-8 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
          aria-labelledby="task-summary"
        >
          <h2 id="task-summary" className="text-sm font-medium text-slate-800">
            Summary
          </h2>
          {currentTask.summary ? (
            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">
              {currentTask.summary}
            </p>
          ) : (
            <p className="mt-3 text-sm leading-6 text-slate-500">No summary provided.</p>
          )}
        </section>

        <TaskFilePreview
          filePath={currentTask.filePath}
          projectPath={projectPath}
          result={filePreview}
        />
        <DeleteTaskSection
          apiPath={apiPath}
          filePath={currentTask.filePath}
          disabled={isUpdatingStatus}
          onError={setError}
          onDeleted={handleDeleted}
        />
      </div>
    </main>
  );
}
