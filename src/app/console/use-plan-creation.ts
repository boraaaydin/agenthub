"use client";

import { useCallback, useEffect, useRef } from "react";

import type { SessionSummary } from "@/lib/agent-protocol";
import { isTaskStatus } from "@/lib/task-filters";

type PlanningSession = {
  projectId: string;
  taskId: number;
  exitHandled: boolean;
};

type ApiError = { error?: string };

type UsePlanCreationOptions = {
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

export function usePlanCreation({ setError }: UsePlanCreationOptions) {
  const planningSessionsRef = useRef(new Map<string, PlanningSession>());
  const controllersRef = useRef(new Set<AbortController>());
  const mountedRef = useRef(true);

  const showError = useCallback((message: string) => {
    if (mountedRef.current) {
      setError(message);
    }
  }, [setError]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      for (const controller of controllersRef.current) {
        controller.abort();
      }
      controllersRef.current.clear();
    };
  }, []);

  const trackPlanningSession = useCallback((session: SessionSummary) => {
    const context = session.execution;
    if (!context || context.planId || planningSessionsRef.current.has(session.id)) {
      return;
    }

    planningSessionsRef.current.set(session.id, {
      projectId: context.projectId,
      taskId: context.taskId,
      exitHandled: false,
    });
  }, []);

  const trackPlanningSessions = useCallback((sessions: SessionSummary[]) => {
    for (const session of sessions) {
      trackPlanningSession(session);
    }
  }, [trackPlanningSession]);

  const handlePlanningSessionExit = useCallback((sessionId: string) => {
    const planningSession = planningSessionsRef.current.get(sessionId);
    if (!planningSession || planningSession.exitHandled) {
      return;
    }

    planningSession.exitHandled = true;
    const hasAnotherPlanningSession = [...planningSessionsRef.current.entries()].some(([id, session]) => (
      id !== sessionId &&
      !session.exitHandled &&
      session.projectId === planningSession.projectId &&
      session.taskId === planningSession.taskId
    ));
    if (hasAnotherPlanningSession) {
      return;
    }

    const controller = new AbortController();
    controllersRef.current.add(controller);
    void (async () => {
      const taskPath = `/api/projects/${encodeURIComponent(planningSession.projectId)}/tasks/${planningSession.taskId}`;
      try {
        const taskResponse = await fetch(taskPath, { signal: controller.signal });
        if (!taskResponse.ok) {
          throw new Error(await readApiError(taskResponse));
        }

        const task = await taskResponse.json() as { status?: unknown };
        if (!isTaskStatus(task.status)) {
          throw new Error("The task response was invalid.");
        }
        if (task.status !== "plan_creating") {
          return;
        }

        const updateResponse = await fetch(taskPath, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "open" }),
          signal: controller.signal,
        });
        if (!updateResponse.ok) {
          throw new Error(await readApiError(updateResponse));
        }
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          showError(
            `Unable to reopen task #${planningSession.taskId} after planning: ${error instanceof Error ? error.message : "Try again."}`,
          );
        }
      } finally {
        controllersRef.current.delete(controller);
      }
    })();
  }, [showError]);

  return { handlePlanningSessionExit, trackPlanningSession, trackPlanningSessions };
}
