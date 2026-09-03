"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import { BrandBar } from "../../../../brand-bar";
import { ProjectChip } from "../../../../project-chip";
import {
  WORKITEM_STATUSES,
  WORKITEM_STATUS_LABELS,
  workitemStatusBadgeClass,
  workitemStatusLabel,
  type WorkitemStatus,
} from "@/lib/workitem-filters";
import { planConsoleHref } from "@/lib/plan-prompt";

type Workitem = {
  id: number;
  projectId: string;
  title: string;
  detail: string;
  status: WorkitemStatus;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type ApiError = { error?: string };

type WorkitemDetailProps = {
  projectName: string;
  projectColor?: string;
  workitem: Workitem;
};

export default function WorkitemDetail({ projectName, projectColor, workitem }: WorkitemDetailProps) {
  const router = useRouter();
  const workitemListPath = `/workitems?project=${encodeURIComponent(workitem.projectId)}`;
  const workitemApiPath = `/api/projects/${workitem.projectId}/workitems/${workitem.id}`;
  const [title, setTitle] = useState(workitem.title);
  const [detail, setDetail] = useState(workitem.detail);
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [workitemStatus, setWorkitemStatus] = useState(workitem.status);
  const [completedAt, setCompletedAt] = useState(workitem.completedAt);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isStatusUpdating, setIsStatusUpdating] = useState(false);
  const [isDeleteConfirming, setIsDeleteConfirming] = useState(false);

  function resetForm() {
    setTitle(workitem.title);
    setDetail(workitem.detail);
    setError("");
    setStatusMessage("");
  }

  async function changeWorkitemStatus(nextStatus: WorkitemStatus) {
    if (nextStatus === workitemStatus || isStatusUpdating || isSubmitting) {
      return;
    }

    setError("");
    setStatusMessage("");
    setIsStatusUpdating(true);

    try {
      const response = await fetch(workitemApiPath, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const body = (await response.json()) as Workitem | ApiError;

      if (!response.ok) {
        setError((body as ApiError).error ?? "Unable to update the workitem. Try again.");
        return;
      }

      const updatedWorkitem = body as Workitem;
      setWorkitemStatus(updatedWorkitem.status);
      setCompletedAt(updatedWorkitem.completedAt);
      setStatusMessage(`Status updated to ${workitemStatusLabel(updatedWorkitem.status)}.`);
      router.refresh();
    } catch {
      setError("Unable to reach the server. Check your connection and try again.");
    } finally {
      setIsStatusUpdating(false);
    }
  }

  async function saveWorkitem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setStatusMessage("");

    if (!title.trim()) {
      setError("Enter a workitem title.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(workitemApiPath, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, detail }),
      });
      const body = (await response.json()) as Workitem | ApiError;

      if (!response.ok) {
        setError((body as ApiError).error ?? "Unable to save changes. Try again.");
        return;
      }

      router.refresh();
      router.replace(workitemListPath);
    } catch {
      setError("Unable to reach the server. Check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function deleteWorkitem() {
    setError("");
    setStatusMessage("");
    setIsSubmitting(true);

    try {
      const response = await fetch(workitemApiPath, { method: "DELETE" });
      const body = (await response.json()) as ApiError;

      if (!response.ok) {
        setError(body.error ?? "Unable to delete the workitem. Try again.");
        return;
      }

      router.replace(workitemListPath);
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
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Link
              href={workitemListPath}
              className="text-sm font-medium text-sky-700 transition hover:text-sky-900 focus:outline-none focus:ring-3 focus:ring-sky-100"
            >
              <ProjectChip projectId={workitem.projectId} name={projectName} color={projectColor} /> workitems
            </Link>
            <span className="text-sm text-slate-500">Workitem #{workitem.id}</span>
            <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${workitemStatusBadgeClass(workitemStatus)}`}>
              {workitemStatusLabel(workitemStatus)}
            </span>
          </div>
          <h1 className="mt-4 break-words text-3xl font-semibold tracking-[-0.03em]">{workitem.title}</h1>
          <p className="mt-1 text-sm leading-6 text-slate-600">Update this workitem&apos;s title and detail.</p>
          {completedAt && (
            <p className="mt-2 text-sm text-slate-600">
              Completed {new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(completedAt))}
            </p>
          )}
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <div className="w-full sm:max-w-xs">
              <label className="block text-sm font-medium text-slate-800" htmlFor="workitem-status">
                Status
              </label>
              <select
                id="workitem-status"
                value={workitemStatus}
                onChange={(event) => changeWorkitemStatus(event.target.value as WorkitemStatus)}
                disabled={isStatusUpdating || isSubmitting}
                className="mt-2 h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-sky-600 focus:ring-3 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100"
              >
                {WORKITEM_STATUSES.map((status) => (
                  <option key={status} value={status}>{WORKITEM_STATUS_LABELS[status]}</option>
                ))}
              </select>
              {isStatusUpdating && <p role="status" className="mt-2 text-sm text-slate-600">Updating status…</p>}
            </div>
            <Link
              href={planConsoleHref(workitem.projectId, workitem.id)}
              className="inline-flex h-10 items-center rounded-xl border border-sky-200 bg-white px-4 text-sm font-medium text-sky-800 shadow-sm transition hover:border-sky-300 hover:bg-sky-50 focus:outline-none focus:ring-3 focus:ring-sky-100"
            >
              Create plan
            </Link>
          </div>
        </header>

        <form onSubmit={saveWorkitem} className="mt-8 space-y-6" noValidate>
          <div>
            <label className="block text-sm font-medium text-slate-800" htmlFor="workitem-title">Workitem title</label>
            <input
              id="workitem-title"
              value={title}
              onChange={(event) => {
                setTitle(event.target.value);
                setStatusMessage("");
              }}
              autoComplete="off"
              disabled={isSubmitting}
              className="mt-2 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-sky-600 focus:ring-3 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-800" htmlFor="workitem-detail">Detail</label>
            <textarea
              id="workitem-detail"
              value={detail}
              onChange={(event) => {
                setDetail(event.target.value);
                setStatusMessage("");
              }}
              disabled={isSubmitting}
              rows={9}
              className="mt-2 w-full resize-y rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm leading-6 outline-none transition focus:border-sky-600 focus:ring-3 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100"
            />
          </div>

          {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
          {statusMessage && <p role="status" className="text-sm text-emerald-700">{statusMessage}</p>}

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={isSubmitting || isStatusUpdating}
              className="h-11 rounded-xl bg-sky-700 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-800 focus:outline-none focus:ring-3 focus:ring-sky-200 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {isSubmitting ? "Saving changes…" : "Save changes"}
            </button>
            <button
              type="button"
              onClick={resetForm}
              disabled={isSubmitting || isStatusUpdating}
              className="h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm font-medium text-slate-800 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-3 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100"
            >
              Cancel
            </button>
          </div>
        </form>

        <section className="mt-10 border-t border-slate-200 pt-6" aria-labelledby="delete-workitem">
          <h2 id="delete-workitem" className="text-sm font-semibold text-slate-900">Delete workitem</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">This permanently removes the workitem from this project&apos;s list.</p>
          {isDeleteConfirming ? (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={deleteWorkitem}
                disabled={isSubmitting || isStatusUpdating}
                className="h-11 rounded-xl bg-red-700 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-red-800 focus:outline-none focus:ring-3 focus:ring-red-200 disabled:cursor-not-allowed disabled:bg-red-300"
              >
                {isSubmitting ? "Deleting workitem…" : "Confirm delete"}
              </button>
              <button
                type="button"
                onClick={() => setIsDeleteConfirming(false)}
                disabled={isSubmitting || isStatusUpdating}
                className="h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm font-medium text-slate-800 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-3 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsDeleteConfirming(true)}
              disabled={isSubmitting || isStatusUpdating}
              className="mt-4 h-11 rounded-xl border border-red-300 bg-white px-4 text-sm font-medium text-red-800 shadow-sm transition hover:border-red-400 hover:bg-red-50 focus:outline-none focus:ring-3 focus:ring-red-100 disabled:cursor-not-allowed disabled:bg-slate-100"
            >
              Delete workitem
            </button>
          )}
        </section>
      </div>
    </main>
  );
}
