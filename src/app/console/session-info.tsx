"use client";

import { useEffect, useRef, useState } from "react";

import type { SessionSummary } from "@/lib/agent-protocol";

type SessionInfoProps = {
  session: Pick<SessionSummary, "id" | "cwd" | "execution">;
};

type PlanResponse = { title?: string };
type TaskResponse = { title?: string };

type ContextTitle = {
  sessionId: string;
  title: string | null;
};

function contextLabel(session: SessionInfoProps["session"], title: string | null) {
  const context = session.execution;
  if (!context) {
    return null;
  }

  const reference = context.planId
    ? `Plan ${context.planId}(Task ${context.taskId})`
    : `Task ${context.taskId}`;
  return title ? `${reference} - ${title}` : reference;
}

export function SessionInfo({ session }: SessionInfoProps) {
  const [contextTitle, setContextTitle] = useState<ContextTitle | null>(null);
  const titleCacheRef = useRef(new Map<string, string | null>());
  const tooltipId = `session-info-${session.id}`;
  const context = session.execution;
  const planId = context?.planId;
  const projectId = context?.projectId;
  const taskId = context?.taskId;

  useEffect(() => {
    if (!projectId || !taskId) {
      return;
    }

    let current = true;
    const cachedTitle = titleCacheRef.current.get(session.id);
    if (cachedTitle !== undefined || titleCacheRef.current.has(session.id)) {
      void Promise.resolve().then(() => {
        if (current) {
          setContextTitle({ sessionId: session.id, title: cachedTitle ?? null });
        }
      });
      return () => {
        current = false;
      };
    }

    const requestProjectId = projectId;
    const requestTaskId = taskId;
    const controller = new AbortController();

    async function loadTitle() {
      const endpoint = planId
        ? `/api/plans/${encodeURIComponent(planId)}`
        : `/api/projects/${encodeURIComponent(requestProjectId)}/tasks/${encodeURIComponent(requestTaskId)}`;
      try {
        const response = await fetch(endpoint, { signal: controller.signal });
        const body = await response.json() as PlanResponse | TaskResponse;
        const title = response.ok && typeof body.title === "string" && body.title.trim()
          ? body.title.trim()
          : null;
        titleCacheRef.current.set(session.id, title);
        if (current) {
          setContextTitle({ sessionId: session.id, title });
        }
      } catch {
        if (!controller.signal.aborted) {
          titleCacheRef.current.set(session.id, null);
          if (current) {
            setContextTitle({ sessionId: session.id, title: null });
          }
        }
      }
    }

    void loadTitle();
    return () => {
      current = false;
      controller.abort();
    };
  }, [planId, projectId, session.id, taskId]);

  const title = contextTitle?.sessionId === session.id ? contextTitle.title : null;
  const label = contextLabel(session, title);

  return (
    <div className="mt-1 flex min-w-0 items-center gap-2">
      {label && <p className="min-w-0 truncate text-sm text-slate-600">{label}</p>}
      <div className="group relative shrink-0">
        <button
          type="button"
          aria-label="Show session information"
          aria-describedby={tooltipId}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-sky-700 focus:outline-none focus:ring-3 focus:ring-sky-100"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
            <circle cx="12" cy="12" r="8.5" />
            <path d="M12 10.5v5" strokeLinecap="round" />
            <path d="M12 7.5h.01" strokeLinecap="round" strokeWidth="3" />
          </svg>
        </button>
        <div
          id={tooltipId}
          role="tooltip"
          className="invisible absolute right-0 top-full z-10 mt-2 w-72 rounded-xl border border-slate-200 bg-white p-3 text-left text-sm text-slate-700 opacity-0 shadow-[0_12px_28px_rgba(15,23,42,0.14)] transition group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"
        >
          <dl className="space-y-1">
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Project path</dt>
            <dd className="break-all font-mono text-xs leading-5 text-slate-700">{session.cwd}</dd>
          </dl>
        </div>
      </div>
    </div>
  );
}
