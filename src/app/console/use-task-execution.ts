"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { TaskStatus } from "@/lib/task-filters";

type Execution = {
  taskId: number;
  projectId: string;
  taskId: number;
  sessionId: string | null;
  exitHandled: boolean;
  prompt: "hidden" | "open" | "success";
  isClosing: boolean;
};

type ExecutionInput = Pick<Execution, "taskId" | "projectId" | "taskId">;
type CompletionInput = ExecutionInput & { sessionId: string; isRunning: boolean };
type CloseSession = (sessionId: string, isRunning: boolean) => boolean;
type ApiError = { error?: string };

type UseTaskExecutionOptions = {
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

export function useTaskExecution({ setError }: UseTaskExecutionOptions) {
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

  const updateTaskStatus = useCallback(async (taskId: number, status: TaskStatus) => {
    const controller = new AbortController();
    controllersRef.current.add(controller);
    try {
      const response = await fetch(`/api/tasks/${encodeURIComponent(taskId)}`, {
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

  const beginExecution = useCallback(({ taskId, projectId, taskId }: ExecutionInput) => {
    updateExecution({ taskId, projectId, taskId, sessionId: null, exitHandled: false, prompt: "hidden", isClosing: false });
    const request = updateTaskStatus(taskId, "executing");
    executingRequestRef.current = request;
    void request.catch((error: unknown) => {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        showError(`Unable to set task #${taskId} to Executing: ${error instanceof Error ? error.message : "Try again."}`);
      }
    });
  }, [showError, updateExecution, updateTaskStatus]);

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
        await updateTaskStatus(current.taskId, "executed");
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          showError(`Unable to set task #${current.taskId} to Executed: ${error instanceof Error ? error.message : "Try again."}`);
        }
      }
    })();
  }, [showError, updateExecution, updateTaskStatus]);

  const dismissPrompt = useCallback(() => {
    const current = executionRef.current;
    if (current?.prompt === "open") {
      updateExecution({ ...current, prompt: "hidden" });
    }
  }, [updateExecution]);

  const completeTaskAndTask = useCallback(async (
    { taskId, projectId, taskId, sessionId, isRunning }: CompletionInput,
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
        await updateTaskStatus(taskId, "completed");
      } catch (error) {
        throw new Error(`Could not complete task #${taskId}: ${error instanceof Error ? error.message : "Try again."}`);
      }

      const response = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/workitems/${encodeURIComponent(taskId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "completed" }),
        },
      );
      if (!response.ok) {
        throw new Error(`Task #${taskId} was completed, but task #${taskId} could not be completed: ${await readApiError(response)}`);
      }
      if (!closeSession(sessionId, isRunning)) {
        throw new Error(`Task #${taskId} and task #${taskId} were completed, but the session could not be closed. Reconnect and try again.`);
      }
      return true;
    } catch (error) {
      showError(error instanceof Error ? error.message : "Unable to complete the task. Try again.");
      return false;
    } finally {
      completingRef.current = false;
      if (mountedRef.current) {
        setIsCompleting(false);
      }
    }
  }, [showError, updateTaskStatus]);

  const confirmClose = useCallback(async (closeSession: CloseSession) => {
    const current = executionRef.current;
    if (!current || current.prompt !== "open" || current.isClosing || !current.sessionId) {
      return;
    }

    updateExecution({ ...current, isClosing: true });
    const wasCompleted = await completeTaskAndTask(
      { ...current, sessionId: current.sessionId, isRunning: false },
      closeSession,
    );
    const latest = executionRef.current;
    if (!latest) {
      return;
    }
    updateExecution({ ...latest, prompt: wasCompleted ? "success" : "open", isClosing: false });
  }, [completeTaskAndTask, updateExecution]);

  return {
    beginExecution,
    claimSession,
    completeTaskAndTask,
    confirmClose,
    dismissPrompt,
    execution,
    handleSessionExit,
    isCompleting,
  };
}
