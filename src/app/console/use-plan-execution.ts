"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { PlanStatus } from "@/lib/plan-filters";

type Execution = {
  planId: number;
  projectId: string;
  taskId: number;
  sessionId: string | null;
  exitHandled: boolean;
  prompt: "hidden" | "open" | "success";
  isClosing: boolean;
};

type ExecutionInput = Pick<Execution, "planId" | "projectId" | "taskId">;
type ApiError = { error?: string };

type UsePlanExecutionOptions = {
  setError: (message: string) => void;
};

async function readApiError(response: Response): Promise<string> {
  try {
    const body = await response.json() as ApiError;
    return body.error ?? "Try again.";
  } catch {
    return "Try again.";
  }
}

export function usePlanExecution({ setError }: UsePlanExecutionOptions) {
  const [execution, setExecution] = useState<Execution | null>(null);
  const executionRef = useRef<Execution | null>(null);
  const mountedRef = useRef(true);
  const controllersRef = useRef(new Set<AbortController>());
  const executingRequestRef = useRef<Promise<void> | null>(null);

  const updateExecution = useCallback((next: Execution | null) => {
    executionRef.current = next;
    if (mountedRef.current) {
      setExecution(next);
    }
  }, []);

  const showError = useCallback((message: string) => {
    if (mountedRef.current) {
      setError(message);
    }
  }, [setError]);

  useEffect(() => () => {
    mountedRef.current = false;
    for (const controller of controllersRef.current) {
      controller.abort();
    }
    controllersRef.current.clear();
  }, []);

  const updatePlanStatus = useCallback(async (planId: number, status: PlanStatus) => {
    const controller = new AbortController();
    controllersRef.current.add(controller);
    try {
      const response = await fetch(`/api/plans/${encodeURIComponent(planId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(await readApiError(response));
      }
    } finally {
      controllersRef.current.delete(controller);
    }
  }, []);

  const beginExecution = useCallback(({ planId, projectId, taskId }: ExecutionInput) => {
    updateExecution({ planId, projectId, taskId, sessionId: null, exitHandled: false, prompt: "hidden", isClosing: false });
    const request = updatePlanStatus(planId, "executing");
    executingRequestRef.current = request;
    void request.catch((error: unknown) => {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        showError(`Unable to set plan #${planId} to Executing: ${error instanceof Error ? error.message : "Try again."}`);
      }
    });
  }, [showError, updateExecution, updatePlanStatus]);

  const claimSession = useCallback((sessionId: string) => {
    const current = executionRef.current;
    if (!current || current.sessionId) {
      return;
    }
    updateExecution({ ...current, sessionId });
  }, [updateExecution]);

  const handleSessionExit = useCallback((sessionId: string) => {
    const current = executionRef.current;
    if (!current || current.sessionId !== sessionId || current.exitHandled) {
      return;
    }

    updateExecution({ ...current, exitHandled: true, prompt: "open" });
    const executingRequest = executingRequestRef.current;
    void (async () => {
      await executingRequest?.catch(() => undefined);
      try {
        await updatePlanStatus(current.planId, "executed");
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          showError(`Unable to set plan #${current.planId} to Executed: ${error instanceof Error ? error.message : "Try again."}`);
        }
      }
    })();
  }, [showError, updateExecution, updatePlanStatus]);

  const dismissPrompt = useCallback(() => {
    const current = executionRef.current;
    if (current?.prompt === "open") {
      updateExecution({ ...current, prompt: "hidden" });
    }
  }, [updateExecution]);

  const confirmClose = useCallback(async (dismissExitedSession: (sessionId: string) => boolean) => {
    const current = executionRef.current;
    if (!current || current.prompt !== "open" || current.isClosing || !current.sessionId) {
      return;
    }

    updateExecution({ ...current, isClosing: true });
    try {
      try {
        await updatePlanStatus(current.planId, "closed");
      } catch (error) {
        throw new Error(`Could not close plan #${current.planId}: ${error instanceof Error ? error.message : "Try again."}`);
      }

      const response = await fetch(
        `/api/projects/${encodeURIComponent(current.projectId)}/tasks/${encodeURIComponent(current.taskId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "completed" }),
        },
      );
      if (!response.ok) {
        throw new Error(`Plan #${current.planId} was closed, but task #${current.taskId} could not be completed: ${await readApiError(response)}`);
      }
      if (!dismissExitedSession(current.sessionId)) {
        throw new Error(`Plan #${current.planId} was closed and task #${current.taskId} was completed, but the exited session could not be dismissed. Reconnect and try again.`);
      }

      updateExecution({ ...current, prompt: "success", isClosing: false });
    } catch (error) {
      const latest = executionRef.current;
      if (latest) {
        updateExecution({ ...latest, isClosing: false });
      }
      showError(error instanceof Error ? error.message : "Unable to close the plan. Try again.");
    }
  }, [showError, updateExecution, updatePlanStatus]);

  return { beginExecution, claimSession, confirmClose, dismissPrompt, execution, handleSessionExit };
}
