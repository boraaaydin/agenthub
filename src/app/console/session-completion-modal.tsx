"use client";

import Link from "next/link";
import { useEffect, useId, useRef } from "react";

import type { SessionOutcomeNotice } from "@/lib/session-completion";

type SessionCompletionModalProps = {
  notice: SessionOutcomeNotice;
  exitCode: number;
  onClose: () => void;
};

export function SessionCompletionModal({
  notice,
  exitCode,
  onClose,
}: SessionCompletionModalProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);

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
          {notice.title}
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">{notice.message}</p>
        {exitCode !== 0 && (
          <p className="mt-2 text-sm font-medium text-slate-700">
            The command exited with code {exitCode}.
          </p>
        )}
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-xl border border-slate-300 bg-white px-4 text-sm font-medium text-slate-800 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-3 focus:ring-sky-100"
          >
            Close
          </button>
          {notice.action && (
            <Link
              href={notice.action.href}
              className="inline-flex h-10 items-center rounded-xl bg-sky-700 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-800 focus:outline-none focus:ring-3 focus:ring-sky-200"
            >
              {notice.action.label}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
