"use client";

type PlanClosePromptProps = {
  planId: number;
  taskId: number;
  isClosing: boolean;
  isClosed: boolean;
  onConfirm: () => void;
  onDismiss: () => void;
};

export function PlanClosePrompt({
  planId,
  taskId,
  isClosing,
  isClosed,
  onConfirm,
  onDismiss,
}: PlanClosePromptProps) {
  if (isClosed) {
    return (
      <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
        Plan #{planId} was closed and task #{taskId} was marked completed. The session was dismissed.
      </p>
    );
  }

  return (
    <section aria-labelledby="plan-close-heading" className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-4 sm:px-5">
      <h2 id="plan-close-heading" className="text-sm font-semibold text-sky-950">Execution finished</h2>
      <p className="mt-1 text-sm leading-6 text-sky-900">
        Close plan #{planId} and mark task #{taskId} as completed?
      </p>
      <div className="mt-3 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onConfirm}
          disabled={isClosing}
          className="h-10 rounded-xl bg-sky-700 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-800 focus:outline-none focus:ring-3 focus:ring-sky-200 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {isClosing ? "Closing plan…" : "Close plan and complete task"}
        </button>
        <button
          type="button"
          onClick={onDismiss}
          disabled={isClosing}
          className="h-10 rounded-xl border border-slate-300 bg-white px-4 text-sm font-medium text-slate-800 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-3 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100"
        >
          Keep plan open
        </button>
      </div>
    </section>
  );
}
