"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, type RefObject } from "react";

import { isAgentId, type AgentId } from "@/lib/agents";
import type { SessionContext } from "@/lib/agent-protocol";

type ConsoleProject = {
  id: string;
  name: string;
  path: string;
};

type PlanPromptResponse = {
  agent: AgentId;
  projectId: string;
  projectName: string;
  projectPath: string;
  taskId: number;
  prompt: string;
};

type ApiError = { error?: string };

type UsePlanRunOptions = {
  planProjectIdRef: RefObject<string | null>;
  planTaskIdRef: RefObject<string | null>;
  connected: boolean;
  isLoadingProjects: boolean;
  terminalReady: boolean;
  projects: ConsoleProject[];
  setAgent: (agent: AgentId) => void;
  setSelectedProjectId: (projectId: string) => void;
  setError: (message: string) => void;
  startSession: (
    agent: AgentId,
    project: ConsoleProject,
    prompt: string,
    autoClose?: boolean,
    context?: SessionContext,
  ) => boolean;
};

function isPlanPromptResponse(value: unknown): value is PlanPromptResponse {
  if (!value || typeof value !== "object") {
    return false;
  }

  const response = value as Record<string, unknown>;
  return (
    isAgentId(response.agent) &&
    typeof response.projectId === "string" &&
    typeof response.projectName === "string" &&
    typeof response.projectPath === "string" &&
    typeof response.taskId === "number" &&
    Number.isInteger(response.taskId) &&
    typeof response.prompt === "string" &&
    Boolean(response.prompt.trim())
  );
}

export function usePlanRun({
  planProjectIdRef,
  planTaskIdRef,
  connected,
  isLoadingProjects,
  terminalReady,
  projects,
  setAgent,
  setSelectedProjectId,
  setError,
  startSession,
}: UsePlanRunOptions) {
  const router = useRouter();
  const planRunStartedRef = useRef(false);

  useEffect(() => {
    const planProjectId = planProjectIdRef.current;
    const planTaskId = planTaskIdRef.current;
    if (
      !planProjectId ||
      !planTaskId ||
      planRunStartedRef.current ||
      !connected ||
      isLoadingProjects ||
      !terminalReady
    ) {
      return;
    }

    const requestProjectId = planProjectId;
    const requestTaskId = planTaskId;
    planRunStartedRef.current = true;
    const controller = new AbortController();

    async function runPlan() {
      try {
        const response = await fetch(
          `/api/projects/${encodeURIComponent(requestProjectId)}/tasks/${encodeURIComponent(requestTaskId)}/plan-prompt`,
          { signal: controller.signal },
        );
        const body = await response.json() as PlanPromptResponse | ApiError;
        if (!response.ok) {
          const message = (body as ApiError).error ?? "Unable to prepare the plan. Try again.";
          throw new Error(
            message === "Task not found."
              ? "The task or its project no longer exists. Return to the task list and try again."
              : message,
          );
        }
        if (!isPlanPromptResponse(body)) {
          throw new Error("The plan request returned an invalid response. Try again.");
        }

        const project = projects.find((candidate) => candidate.id === body.projectId);
        if (!project || project.path !== body.projectPath || body.projectId !== requestProjectId) {
          throw new Error("The task's project is no longer available. Return to the task list and try again.");
        }

        setSelectedProjectId(project.id);
        setAgent(body.agent);
        if (!startSession(
          body.agent,
          project,
          body.prompt,
          true,
          { projectId: body.projectId, taskId: body.taskId },
        )) {
          throw new Error("The terminal connection is not ready. Try again in a moment.");
        }
        router.replace("/console");
      } catch (error) {
        if (!controller.signal.aborted) {
          setError(error instanceof Error ? error.message : "Unable to prepare the plan. Try again.");
        }
      }
    }

    void runPlan();
    return () => controller.abort();
  }, [
    connected,
    isLoadingProjects,
    planProjectIdRef,
    planTaskIdRef,
    projects,
    router,
    setAgent,
    setError,
    setSelectedProjectId,
    startSession,
    terminalReady,
  ]);
}
