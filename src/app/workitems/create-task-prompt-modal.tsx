"use client";

import { useEffect, useId, useRef } from "react";

type CreateTaskPromptModalProps = {
  canCreateTask: boolean;
  hasApplications: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export function CreateTaskPromptModal({
  canCreateTask,
  hasApplications,
  onClose,
  onConfirm,
}: CreateTaskPromptModalProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const cannotCreateTask = !canCreateTask || !hasApplications;
  const message = !hasApplications
    ? "This project has no applications. Add an application before creating a task."
    : !canCreateTask
      ? "This workitem has unfinished dependencies. Complete or cancel them before creating a task."
      : "Would you like to create a task for this workitem now?";

  useEffect(() => {
    dialogRef.current?.focus();

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="w-full max-w-md rounded-[14px] border border-slate-200 bg-white p-6 shadow-[0_24px_56px_rgba(15,23,42,0.28)] outline-none"
      >
        <h2 id={titleId} className="text-lg font-semibold text-slate-900">
          {cannotCreateTask ? "Task cannot be created yet" : "Create a task now?"}
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">{message}</p>
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-xl border border-slate-300 bg-white px-4 text-sm font-medium text-slate-800 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-3 focus:ring-sky-100"
          >
            {cannotCreateTask ? "Close" : "Not now"}
          </button>
          {!cannotCreateTask && (
            <button
              type="button"
              onClick={onConfirm}
              className="h-10 rounded-xl bg-sky-700 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-800 focus:outline-none focus:ring-3 focus:ring-sky-200"
            >
              Create task
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
