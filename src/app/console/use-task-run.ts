"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, type RefObject } from "react";

import { isAgentId, type AgentId } from "@/lib/agents";
import type { SessionContext } from "@/lib/agent-protocol";
import type { SessionCompletion } from "@/lib/session-completion";

type Project = {
  id: string;
  name: string;
  path: string;
  applications: { id: string; name: string; path: string }[];
};
type Response = {
  agent: AgentId;
  taskId: number;
  projectId: string;
  projectPath: string;
  applicationId: string;
  applicationPath: string;
  workitemId: number;
  prompt: string;
};

type Options = {
  taskIdRef: RefObject<string | null>;
  connected: boolean;
  isLoadingProjects: boolean;
  terminalReady: boolean;
  projects: Project[];
  setAgent: (agent: AgentId) => void;
  setSelectedProjectId: (id: string) => void;
  setSelectedApplicationId: (id: string) => void;
  setError: (message: string) => void;
  startSession: (
    agent: AgentId,
    project: Project,
    prompt: string,
    completion?: SessionCompletion,
    context?: SessionContext,
    cwd?: string,
  ) => boolean;
  beginExecution: (execution: Required<SessionContext>) => void;
};

export function useTaskRun({
  taskIdRef,
  connected,
  isLoadingProjects,
  terminalReady,
  projects,
  setAgent,
  setSelectedProjectId,
  setSelectedApplicationId,
  setError,
  startSession,
  beginExecution,
}: Options) {
  const router = useRouter();
  const started = useRef(false);

  useEffect(() => {
    const taskId = taskIdRef.current;
    if (
      !taskId ||
      started.current ||
      !connected ||
      isLoadingProjects ||
      !terminalReady
    ) {
      return;
    }

    started.current = true;
    const controller = new AbortController();

    void (async () => {
      try {
        const response = await fetch(`/api/tasks/${taskId}/execution-prompt`, {
          signal: controller.signal,
        });
        const body = (await response.json()) as Response | { error?: string };
        if (
          !response.ok ||
          !isAgentId((body as Response).agent) ||
          typeof (body as Response).workitemId !== "number"
        ) {
          throw new Error(
            (body as { error?: string }).error ?? "Unable to prepare the task.",
          );
        }

        const result = body as Response;
        const project = projects.find(
          (candidate) =>
            candidate.id === result.projectId &&
            candidate.path === result.projectPath,
        );
        const application = project?.applications.find(
          (candidate) =>
            candidate.id === result.applicationId &&
            candidate.path === result.applicationPath,
        );
        const execution: Required<SessionContext> = {
          projectId: result.projectId,
          workitemId: result.workitemId,
          taskId: result.taskId,
          applicationId: result.applicationId,
        };
        if (
          !project ||
          !application ||
          !startSession(
            result.agent,
            project,
            result.prompt,
            undefined,
            execution,
            application.path,
          )
        ) {
          throw new Error("The terminal connection is not ready.");
        }

        setSelectedProjectId(project.id);
        setSelectedApplicationId(application.id);
        setAgent(result.agent);
        beginExecution(execution);
        router.replace("/console");
      } catch (error) {
        if (!controller.signal.aborted) {
          setError(
            error instanceof Error ? error.message : "Unable to prepare the task.",
          );
        }
      }
    })();

    return () => controller.abort();
  }, [
    beginExecution,
    connected,
    isLoadingProjects,
    projects,
    router,
    setAgent,
    setError,
    setSelectedProjectId,
    setSelectedApplicationId,
    startSession,
    taskIdRef,
    terminalReady,
  ]);
}
