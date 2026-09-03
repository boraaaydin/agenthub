"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { TaskStatus } from "@/lib/task-filters";

type Execution = { taskId: number; projectId: string; workitemId: number; sessionId: string | null; exitHandled: boolean; prompt: "hidden" | "open" | "success"; isClosing: boolean };
type ExecutionInput = Pick<Execution, "taskId" | "projectId" | "workitemId">;
type CompletionInput = ExecutionInput & { sessionId: string; isRunning: boolean };
type CloseSession = (sessionId: string, isRunning: boolean) => boolean;
async function errorMessage(response: Response) { try { return ((await response.json()) as { error?: string }).error ?? "Try again."; } catch { return "Try again."; } }

export function useTaskExecution({ setError }: { setError: (message: string) => void }) {
  const [execution, setExecution] = useState<Execution | null>(null); const [isCompleting, setIsCompleting] = useState(false);
  const ref = useRef<Execution | null>(null); const mounted = useRef(true); const completing = useRef(false);
  const set = useCallback((next: Execution | null) => { ref.current = next; if (mounted.current) setExecution(next); }, []);
  useEffect(() => () => { mounted.current = false; }, []);
  const updateTaskStatus = useCallback(async (taskId: number, status: TaskStatus) => {
    const response = await fetch(`/api/tasks/${taskId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    if (!response.ok) throw new Error(await errorMessage(response));
  }, []);
  const beginExecution = useCallback(({ taskId, projectId, workitemId }: ExecutionInput) => {
    set({ taskId, projectId, workitemId, sessionId: null, exitHandled: false, prompt: "hidden", isClosing: false });
    void updateTaskStatus(taskId, "executing").catch((error: unknown) => setError(`Unable to set task #${taskId} to Executing: ${error instanceof Error ? error.message : "Try again."}`));
  }, [set, setError, updateTaskStatus]);
  const claimSession = useCallback((sessionId: string) => { const current = ref.current; if (current && !current.sessionId) set({ ...current, sessionId }); }, [set]);
  const handleSessionExit = useCallback((sessionId: string) => { const current = ref.current; if (!current || current.sessionId !== sessionId || current.exitHandled) return; set({ ...current, exitHandled: true, prompt: "open" }); void updateTaskStatus(current.taskId, "executed").catch((error: unknown) => setError(`Unable to set task #${current.taskId} to Executed: ${error instanceof Error ? error.message : "Try again."}`)); }, [set, setError, updateTaskStatus]);
  const dismissPrompt = useCallback(() => { const current = ref.current; if (current?.prompt === "open") set({ ...current, prompt: "hidden" }); }, [set]);
  const completeTaskAndWorkitem = useCallback(async ({ taskId, projectId, workitemId, sessionId, isRunning }: CompletionInput, closeSession: CloseSession) => {
    if (completing.current) return false; completing.current = true; setIsCompleting(true);
    try {
      await updateTaskStatus(taskId, "completed");
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/workitems/${workitemId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "completed" }) });
      if (!response.ok) throw new Error(`Task #${taskId} was completed, but workitem #${workitemId} could not be completed: ${await errorMessage(response)}`);
      if (!closeSession(sessionId, isRunning)) throw new Error(`Task #${taskId} and workitem #${workitemId} were marked completed, but the session could not be closed.`);
      return true;
    } catch (error) { setError(error instanceof Error ? error.message : "Unable to complete the task. Try again."); return false; }
    finally { completing.current = false; if (mounted.current) setIsCompleting(false); }
  }, [setError, updateTaskStatus]);
  const confirmClose = useCallback(async (closeSession: CloseSession) => { const current = ref.current; if (!current || current.prompt !== "open" || current.isClosing || !current.sessionId) return; set({ ...current, isClosing: true }); const done = await completeTaskAndWorkitem({ ...current, sessionId: current.sessionId, isRunning: false }, closeSession); const latest = ref.current; if (latest) set({ ...latest, prompt: done ? "success" : "open", isClosing: false }); }, [completeTaskAndWorkitem, set]);
  return { beginExecution, claimSession, completeTaskAndWorkitem, confirmClose, dismissPrompt, execution, handleSessionExit, isCompleting };
}
