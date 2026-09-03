"use client";

type TaskCompletionActionProps = {
  isCompleting: boolean;
  isSessionRunning: boolean;
  onComplete: () => void;
};

export function TaskCompletionAction({ isCompleting, isSessionRunning, onComplete }: TaskCompletionActionProps) {
  return (
    <button
      type="button"
      onClick={onComplete}
      disabled={isCompleting || isSessionRunning}
      title={isSessionRunning ? "Wait for the agent session to exit before completing the task." : undefined}
      className="h-10 rounded-xl bg-sky-700 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-800 focus:outline-none focus:ring-3 focus:ring-sky-200 disabled:cursor-not-allowed disabled:bg-slate-300"
    >
      {isCompleting ? "Completing…" : "Complete task"}
    </button>
  );
}
