"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { WORKITEM_ACTION_NEUTRAL_CLASS } from "./action-button-styles";
import { CreateTaskPromptModal } from "./create-task-prompt-modal";
import { planConsoleHref } from "@/lib/plan-prompt";

type ApiError = { error?: string };

type PromoteWorkitemButtonProps = {
  projectId: string;
  workitemId: number;
  canCreateTask: boolean;
  hasApplications: boolean;
  onPromoted?: () => void;
};

export function PromoteWorkitemButton({
  projectId,
  workitemId,
  canCreateTask,
  hasApplications,
  onPromoted,
}: PromoteWorkitemButtonProps) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isPromoting, setIsPromoting] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  async function promoteWorkitem() {
    setError("");
    setIsPromoting(true);

    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/workitems/${workitemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "workitem" }),
      });
      const body = (await response.json()) as ApiError;

      if (!response.ok) {
        setError(body.error ?? "Unable to convert the draft. Try again.");
        return;
      }

      onPromoted?.();
      setIsModalOpen(true);
    } catch {
      setError("Unable to reach the server. Check your connection and try again.");
    } finally {
      setIsPromoting(false);
    }
  }

  function closeModal() {
    setIsModalOpen(false);
    router.refresh();
  }

  function createTask() {
    router.push(planConsoleHref(projectId, workitemId));
  }

  return (
    <div>
      <button
        type="button"
        onClick={promoteWorkitem}
        disabled={isPromoting}
        className={WORKITEM_ACTION_NEUTRAL_CLASS}
      >
        {isPromoting ? "Converting…" : "Convert to workitem"}
      </button>
      {error && <p role="alert" className="mt-2 text-xs text-red-700">{error}</p>}
      {isModalOpen && (
        <CreateTaskPromptModal
          canCreateTask={canCreateTask}
          hasApplications={hasApplications}
          onClose={closeModal}
          onConfirm={createTask}
        />
      )}
    </div>
  );
}
