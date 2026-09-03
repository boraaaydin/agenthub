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

type TaskPromptResponse = {
  agent: AgentId;
  planId: number;
  projectId: string;
  projectName: string;
  projectPath: string;
  taskId: number;
  filePath: string;
  prompt: string;
};

type ApiError = { error?: string };

type UseTaskRunOptions = {
  planIdRef: RefObject<string | null>;
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
  beginExecution: (execution: Required<SessionContext>) => void;
};

function isTaskPromptResponse(value: unknown): value is TaskPromptResponse {
  if (!value || typeof value !== "object") {
    return false;
  }

  const response = value as Record<string, unknown>;
  return (
    isAgentId(response.agent) &&
    typeof response.planId === "number" &&
    Number.isInteger(response.planId) &&
    response.planId > 0 &&
    typeof response.projectId === "string" &&
    typeof response.projectName === "string" &&
    typeof response.projectPath === "string" &&
    typeof response.taskId === "number" &&
    Number.isInteger(response.taskId) &&
    response.taskId > 0 &&
    typeof response.filePath === "string" &&
    Boolean(response.filePath.trim()) &&
    typeof response.prompt === "string" &&
    Boolean(response.prompt.trim())
  );
}

export function useTaskRun({
  planIdRef,
  connected,
  isLoadingProjects,
  terminalReady,
  projects,
  setAgent,
  setSelectedProjectId,
  setError,
  startSession,
  beginExecution,
}: UseTaskRunOptions) {
  const router = useRouter();
  const taskRunStartedRef = useRef(false);

  useEffect(() => {
    const planId = planIdRef.current;
    if (!planId || taskRunStartedRef.current || !connected || isLoadingProjects || !terminalReady) {
      return;
    }

    const requestPlanId = planId;
    taskRunStartedRef.current = true;
    const controller = new AbortController();

    async function runTask() {
      try {
        const response = await fetch(`/api/plans/${encodeURIComponent(requestPlanId)}/task-prompt`, { signal: controller.signal });
        const body = await response.json() as TaskPromptResponse | ApiError;
        if (!response.ok) {
          const message = (body as ApiError).error ?? "Unable to prepare the task. Try again.";
          throw new Error(
            message === "Plan not found."
              ? "The plan or its project no longer exists. Return to the plans list and try again."
              : message,
          );
        }
        if (!isTaskPromptResponse(body)) {
          throw new Error("The task request returned an invalid response. Try again.");
        }
        if (String(body.planId) !== requestPlanId) {
          throw new Error("The plan request returned an invalid response. Try again.");
        }

        const project = projects.find((candidate) => candidate.id === body.projectId);
        if (!project || project.path !== body.projectPath) {
          throw new Error("The plan's project is no longer available. Return to the plans list and try again.");
        }

        const execution: Required<SessionContext> = {
          planId: body.planId,
          projectId: body.projectId,
          taskId: body.taskId,
        };
        setSelectedProjectId(project.id);
        setAgent(body.agent);
        if (!startSession(body.agent, project, body.prompt, false, execution)) {
          throw new Error("The terminal connection is not ready. Try again in a moment.");
        }
        beginExecution(execution);
        router.replace("/console");
      } catch (error) {
        if (!controller.signal.aborted) {
          setError(error instanceof Error ? error.message : "Unable to prepare the task. Try again.");
        }
      }
    }

    void runTask();
    return () => controller.abort();
  }, [
    beginExecution,
    connected,
    isLoadingProjects,
    planIdRef,
    projects,
    router,
    setAgent,
    setError,
    setSelectedProjectId,
    startSession,
    terminalReady,
  ]);
}
