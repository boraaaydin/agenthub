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
type CompletionInput = ExecutionInput & { sessionId: string; isRunning: boolean };
type CloseSession = (sessionId: string, isRunning: boolean) => boolean;
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
  const [isCompleting, setIsCompleting] = useState(false);
  const executionRef = useRef<Execution | null>(null);
  const mountedRef = useRef(true);
  const controllersRef = useRef(new Set<AbortController>());
  const executingRequestRef = useRef<Promise<void> | null>(null);
  const completingRef = useRef(false);

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

  const completePlanAndTask = useCallback(async (
    { planId, projectId, taskId, sessionId, isRunning }: CompletionInput,
    closeSession: CloseSession,
  ) => {
    if (completingRef.current) {
      return false;
    }

    completingRef.current = true;
    if (mountedRef.current) {
      setIsCompleting(true);
    }
    try {
      try {
        await updatePlanStatus(planId, "completed");
      } catch (error) {
        throw new Error(`Could not complete plan #${planId}: ${error instanceof Error ? error.message : "Try again."}`);
      }

      const response = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(taskId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "completed" }),
        },
      );
      if (!response.ok) {
        throw new Error(`Plan #${planId} was completed, but task #${taskId} could not be completed: ${await readApiError(response)}`);
      }
      if (!closeSession(sessionId, isRunning)) {
        throw new Error(`Plan #${planId} and task #${taskId} were completed, but the session could not be closed. Reconnect and try again.`);
      }
      return true;
    } catch (error) {
      showError(error instanceof Error ? error.message : "Unable to complete the plan. Try again.");
      return false;
    } finally {
      completingRef.current = false;
      if (mountedRef.current) {
        setIsCompleting(false);
      }
    }
  }, [showError, updatePlanStatus]);

  const confirmClose = useCallback(async (closeSession: CloseSession) => {
    const current = executionRef.current;
    if (!current || current.prompt !== "open" || current.isClosing || !current.sessionId) {
      return;
    }

    updateExecution({ ...current, isClosing: true });
    const wasCompleted = await completePlanAndTask(
      { ...current, sessionId: current.sessionId, isRunning: false },
      closeSession,
    );
    const latest = executionRef.current;
    if (!latest) {
      return;
    }
    updateExecution({ ...latest, prompt: wasCompleted ? "success" : "open", isClosing: false });
  }, [completePlanAndTask, updateExecution]);

  return {
    beginExecution,
    claimSession,
    completePlanAndTask,
    confirmClose,
    dismissPrompt,
    execution,
    handleSessionExit,
    isCompleting,
  };
}
