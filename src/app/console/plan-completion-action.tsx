"use client";

type PlanCompletionActionProps = {
  isCompleting: boolean;
  onComplete: () => void;
};

export function PlanCompletionAction({ isCompleting, onComplete }: PlanCompletionActionProps) {
  return (
    <button
      type="button"
      onClick={onComplete}
      disabled={isCompleting}
      className="h-10 rounded-xl bg-sky-700 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-800 focus:outline-none focus:ring-3 focus:ring-sky-200 disabled:cursor-not-allowed disabled:bg-slate-300"
    >
      {isCompleting ? "Completing…" : "Complete task and plan"}
    </button>
  );
}
