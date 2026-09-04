"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { WORKITEM_ACTION_DANGER_CLASS, WORKITEM_ACTION_NEUTRAL_CLASS } from "./action-button-styles";
import type { WorkitemStatus } from "@/lib/workitem-filters";

type DeleteTasksResponse = {
  error?: string;
  deletedCount?: number;
  fileDeletedCount?: number;
  fileErrors?: string[];
  status?: WorkitemStatus;
};

type DeleteWorkitemTasksButtonProps = {
  projectId: string;
  workitemId: number;
  taskCount: number;
  onDeleted?: (status?: WorkitemStatus) => void;
};

export function DeleteWorkitemTasksButton({ projectId, workitemId, taskCount, onDeleted }: DeleteWorkitemTasksButtonProps) {
  const router = useRouter();
  const [isConfirming, setIsConfirming] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");

  async function deleteTasks() {
    setError("");
    setWarning("");
    setIsDeleting(true);

    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/workitems/${workitemId}/tasks`, {
        method: "DELETE",
      });
      const body = (await response.json()) as DeleteTasksResponse;

      if (!response.ok) {
        setError(body.error ?? "Unable to delete the tasks. Try again.");
        return;
      }

      setIsConfirming(false);
      if (body.fileErrors?.length) {
        setWarning(body.fileErrors.join(" "));
      }
      onDeleted?.(body.status);
      router.refresh();
    } catch {
      setError("Unable to reach the server. Check your connection and try again.");
    } finally {
      setIsDeleting(false);
    }
  }

  // The controls are rendered as direct children of the surrounding action row so the
  // confirm pair replaces the button in place instead of moving the row around it.
  return (
    <>
      {taskCount > 0 && (isConfirming ? (
        <>
          <button type="button" onClick={deleteTasks} disabled={isDeleting} className={WORKITEM_ACTION_DANGER_CLASS}>
            {isDeleting ? "Deleting…" : "Confirm"}
          </button>
          <button
            type="button"
            onClick={() => setIsConfirming(false)}
            disabled={isDeleting}
            className={WORKITEM_ACTION_NEUTRAL_CLASS}
          >
            Cancel
          </button>
        </>
      ) : (
        <button type="button" onClick={() => setIsConfirming(true)} className={WORKITEM_ACTION_DANGER_CLASS}>
          Delete tasks
        </button>
      ))}
      {error && <p role="alert" className="basis-full text-xs text-red-700">{error}</p>}
      {warning && <p role="status" className="basis-full text-xs text-amber-700">{warning}</p>}
    </>
  );
}
