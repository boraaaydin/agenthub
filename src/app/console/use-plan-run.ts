"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, type RefObject } from "react";

import { isAgentId, type AgentId } from "@/lib/agents";
import type { SessionContext } from "@/lib/agent-protocol";
import type { SessionCompletion } from "@/lib/session-completion";

type Project = { id: string; name: string; path: string };
type Response = {
  agent: AgentId;
  projectId: string;
  projectPath: string;
  workitemId: number;
  prompt: string;
};

type Options = {
  planProjectIdRef: RefObject<string | null>;
  planWorkitemIdRef: RefObject<string | null>;
  connected: boolean;
  isLoadingProjects: boolean;
  terminalReady: boolean;
  projects: Project[];
  setAgent: (agent: AgentId) => void;
  setSelectedProjectId: (id: string) => void;
  setError: (message: string) => void;
  startSession: (
    agent: AgentId,
    project: Project,
    prompt: string,
    completion?: SessionCompletion,
    context?: SessionContext,
  ) => boolean;
};

export function usePlanRun({
  planProjectIdRef,
  planWorkitemIdRef,
  connected,
  isLoadingProjects,
  terminalReady,
  projects,
  setAgent,
  setSelectedProjectId,
  setError,
  startSession,
}: Options) {
  const router = useRouter();
  const started = useRef(false);

  useEffect(() => {
    const projectId = planProjectIdRef.current;
    const workitemId = planWorkitemIdRef.current;
    if (
      !projectId ||
      !workitemId ||
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
        const response = await fetch(
          `/api/projects/${encodeURIComponent(projectId)}/workitems/${workitemId}/plan-prompt`,
          { signal: controller.signal },
        );
        const body = (await response.json()) as Response | { error?: string };
        if (
          !response.ok ||
          !isAgentId((body as Response).agent) ||
          typeof (body as Response).workitemId !== "number"
        ) {
          throw new Error(
            (body as { error?: string }).error ?? "Unable to prepare the plan.",
          );
        }

        const result = body as Response;
        const project = projects.find(
          (candidate) =>
            candidate.id === result.projectId &&
            candidate.path === result.projectPath,
        );
        if (
          !project ||
          !startSession(
            result.agent,
            project,
            result.prompt,
            { closeOnExit: "always" },
            {
              projectId: result.projectId,
              workitemId: result.workitemId,
            },
          )
        ) {
          throw new Error("The terminal connection is not ready.");
        }

        setSelectedProjectId(project.id);
        setAgent(result.agent);
        await fetch(
          `/api/projects/${encodeURIComponent(result.projectId)}/workitems/${result.workitemId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "task_creating" }),
          },
        );
        router.replace("/console");
      } catch (error) {
        if (!controller.signal.aborted) {
          setError(
            error instanceof Error ? error.message : "Unable to prepare the plan.",
          );
        }
      }
    })();

    return () => controller.abort();
  }, [
    connected,
    isLoadingProjects,
    planProjectIdRef,
    planWorkitemIdRef,
    projects,
    router,
    setAgent,
    setError,
    setSelectedProjectId,
    startSession,
    terminalReady,
  ]);
}
