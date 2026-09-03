"use client";

import { useState } from "react";

type ApiError = { error?: string; fileDeleted?: boolean; fileError?: string };

type DeleteTaskSectionProps = {
  apiPath: string;
  filePath: string;
  disabled: boolean;
  onError: (message: string) => void;
  onDeleted: (fileError?: string) => void;
};

export function DeleteTaskSection({ apiPath, filePath, disabled, onError, onDeleted }: DeleteTaskSectionProps) {
  const [isConfirming, setIsConfirming] = useState(false);
  const [deleteFile, setDeleteFile] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  async function deleteTask() {
    setIsDeleting(true);
    onError("");

    try {
      const response = await fetch(`${apiPath}${deleteFile ? "?file=delete" : ""}`, { method: "DELETE" });
      const body = (await response.json()) as ApiError;
      if (!response.ok) {
        onError(body.error ?? "Unable to delete the task. Try again.");
        return;
      }
      onDeleted(body.fileDeleted === false ? body.fileError : undefined);
    } catch {
      onError("Unable to reach the server. Check your connection and try again.");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <section className="mt-10 border-t border-slate-200 pt-6" aria-labelledby="delete-task">
      <h2 id="delete-task" className="text-sm font-semibold text-slate-900">Delete task</h2>
      <p className="mt-1 text-sm leading-6 text-slate-600">This permanently removes the task record. Its file stays on disk unless you explicitly choose to remove it too.</p>
      {isConfirming ? (
        <div className="mt-4 space-y-4 rounded-xl border border-red-200 bg-red-50 p-4">
          <label className="flex cursor-pointer items-start gap-3 text-sm leading-6 text-slate-800">
            <input
              type="checkbox"
              checked={deleteFile}
              onChange={(event) => setDeleteFile(event.target.checked)}
              disabled={disabled || isDeleting}
              className="mt-1 size-4 rounded border-slate-300 text-red-700 focus:ring-red-200"
            />
            <span>Also delete the task file from disk (<span className="break-all font-mono text-xs">{filePath}</span>)</span>
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={deleteTask} disabled={disabled || isDeleting} className="h-11 rounded-xl bg-red-700 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-red-800 focus:outline-none focus:ring-3 focus:ring-red-200 disabled:cursor-not-allowed disabled:bg-red-300">
              {isDeleting ? "Deleting task…" : "Confirm delete"}
            </button>
            <button type="button" onClick={() => setIsConfirming(false)} disabled={disabled || isDeleting} className="h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm font-medium text-slate-800 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-3 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setIsConfirming(true)} disabled={disabled} className="mt-4 h-11 rounded-xl border border-red-300 bg-white px-4 text-sm font-medium text-red-800 shadow-sm transition hover:border-red-400 hover:bg-red-50 focus:outline-none focus:ring-3 focus:ring-red-100 disabled:cursor-not-allowed disabled:bg-slate-100">
          Delete task
        </button>
      )}
    </section>
  );
}
