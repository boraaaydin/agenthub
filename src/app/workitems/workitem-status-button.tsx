"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { WORKITEM_ACTION_NEUTRAL_CLASS } from "./action-button-styles";
import type { WorkitemStatus } from "@/lib/workitem-filters";

type WorkitemStatusButtonProps = {
  projectId: string;
  workitemId: number;
  status: WorkitemStatus;
};

type ApiError = { error?: string };

export function WorkitemStatusButton({ projectId, workitemId, status }: WorkitemStatusButtonProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const nextStatus = status === "completed" ? "open" : "completed";
  const label = status === "completed" ? "Reopen" : "Complete";

  async function toggleStatus() {
    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/workitems/${workitemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const body = (await response.json()) as ApiError;

      if (!response.ok) {
        setError(body.error ?? "Unable to update the workitem. Try again.");
        return;
      }

      router.refresh();
    } catch {
      setError("Unable to reach the server. Check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (status !== "open" && status !== "task_created" && status !== "completed") {
    return null;
  }

  return (
    <div>
      <button
        type="button"
        onClick={toggleStatus}
        disabled={isSubmitting}
        className={WORKITEM_ACTION_NEUTRAL_CLASS}
      >
        {isSubmitting ? `${label}…` : label}
      </button>
      {error && <p role="alert" className="mt-2 text-xs text-red-700">{error}</p>}
    </div>
  );
}
