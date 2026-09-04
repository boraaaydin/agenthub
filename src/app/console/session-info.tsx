"use client";

import { useEffect, useRef, useState } from "react";

import type { AgentSessionSummary } from "@/lib/agent-protocol";
import { resolveSessionProject, type SessionProject } from "./session-project";

type Props = {
  session: Pick<AgentSessionSummary, "id" | "cwd" | "execution">;
  projects: SessionProject[];
};

export function SessionInfo({ session, projects }: Props) {
  const [title, setTitle] = useState<string | null>(null);
  const cache = useRef(new Map<string, string | null>());
  const context = session.execution;

  useEffect(() => {
    if (!context) {
      return;
    }

    const endpoint = context.taskId
      ? `/api/tasks/${context.taskId}`
      : `/api/projects/${context.projectId}/workitems/${context.workitemId}`;
    const cached = cache.current.get(session.id);
    if (cached !== undefined) {
      setTitle(cached);
      return;
    }

    const controller = new AbortController();
    void fetch(endpoint, { signal: controller.signal })
      .then(async (response) => {
        const body = await response.json() as { title?: string };
        const next = response.ok && typeof body.title === "string" ? body.title : null;
        cache.current.set(session.id, next);
        setTitle(next);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [context, session.id]);

  if (!context) {
    return null;
  }

  const { application: cwdApplication } = resolveSessionProject(session.cwd, projects);
  const application = context.applicationId
    ? projects.flatMap((project) => project.applications).find(
      (candidate) => candidate.id === context.applicationId,
    ) ?? cwdApplication
    : cwdApplication;
  const label = context.taskId
    ? `Task ${context.taskId} (Workitem ${context.workitemId})${application ? ` · ${application.name}` : ""}`
    : `Workitem ${context.workitemId}`;

  return (
    <div className="mt-1 flex min-w-0 items-center gap-2">
      <p className="min-w-0 truncate text-sm text-slate-600">{title ? `${label} - ${title}` : label}</p>
      <span title={session.cwd} className="text-xs text-slate-500">ⓘ</span>
    </div>
  );
}
