"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { TaskStatus } from "@/lib/task-filters";

type TaskStatusButtonProps = {
  projectId: string;
  taskId: number;
  status: TaskStatus;
};

type ApiError = { error?: string };

export function TaskStatusButton({ projectId, taskId, status }: TaskStatusButtonProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const nextStatus = status === "open" ? "completed" : "open";
  const label = status === "open" ? "Complete" : "Reopen";

  async function toggleStatus() {
    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const body = (await response.json()) as ApiError;

      if (!response.ok) {
        setError(body.error ?? "Unable to update the task. Try again.");
        return;
      }

      router.refresh();
    } catch {
      setError("Unable to reach the server. Check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (status !== "open" && status !== "completed") {
    return null;
  }

  return (
    <div>
      <button
        type="button"
        onClick={toggleStatus}
        disabled={isSubmitting}
        className="inline-flex h-9 items-center rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-800 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-3 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100"
      >
        {isSubmitting ? `${label}…` : label}
      </button>
      {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
    </div>
  );
}
