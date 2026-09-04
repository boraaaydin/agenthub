"use client";

import { ProjectChip } from "../project-chip";
import { getAgent, type AgentId } from "@/lib/agents";
import { getRemoteAccessAction } from "@/lib/remote-access";
import type { SessionSummary } from "@/lib/agent-protocol";
import { AgentLogo } from "./agent-logo";

type SidebarProject = { id: string; path: string; name: string; color?: string };

const AGENT_ACCENT_CLASSES: Record<AgentId, string> = {
  codex: "text-emerald-700",
  claude: "text-orange-700",
  pi: "text-violet-700",
};

function sessionProject(cwd: string, projects: SidebarProject[]) {
  return projects.find((candidate) => candidate.path === cwd);
}

function sessionLabel(cwd: string, project?: SidebarProject) {
  return project?.name ?? cwd.split("/").filter(Boolean).at(-1) ?? cwd;
}

type SessionSidebarProps = {
  sessions: SessionSummary[];
  projects: SidebarProject[];
  selectedSessionId: string | null;
  onSelect: (sessionId: string) => void;
  onNewSession: () => void;
  onDismiss: (sessionId: string) => void;
};

export function SessionSidebar({
  sessions,
  projects,
  selectedSessionId,
  onSelect,
  onNewSession,
  onDismiss,
}: SessionSidebarProps) {
  return (
    <aside className="flex min-h-0 flex-col rounded-[14px] border border-slate-200 bg-white lg:min-h-[620px]">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-900">Sessions</h2>
        <button
          type="button"
          onClick={onNewSession}
          className="rounded-lg bg-sky-700 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-sky-800 focus:outline-none focus:ring-3 focus:ring-sky-200"
        >
          New session
        </button>
      </div>

      <div className="min-h-0 overflow-y-auto p-2">
        {sessions.length === 0 ? (
          <p className="px-2 py-4 text-sm leading-6 text-slate-600">
            Start a session to keep its terminal and scrollback here.
          </p>
        ) : (
          <ul className="space-y-1" aria-label="Open terminal sessions">
            {sessions.map((session) => {
              const selected = session.id === selectedSessionId;
              const exited = session.state === "exited";
              const project = sessionProject(session.cwd, projects);
              const projectName = sessionLabel(session.cwd, project);
              const label = session.kind === "agent"
                ? getAgent(session.agent).label
                : getRemoteAccessAction(session.action).label;

              return (
                <li key={session.id} className="flex items-stretch gap-1">
                  <button
                    type="button"
                    onClick={() => onSelect(session.id)}
                    className={`min-w-0 flex-1 rounded-lg px-3 py-2 text-left transition focus:outline-none focus:ring-3 focus:ring-sky-100 ${
                      selected
                        ? "bg-sky-50 text-sky-950"
                        : "text-slate-700 hover:bg-slate-50"
                    }`}
                    aria-current={selected ? "page" : undefined}
                  >
                    <span className="flex items-center gap-2 text-sm font-medium">
                      <span
                        aria-hidden="true"
                        className={`h-2 w-2 shrink-0 rounded-full ${exited ? "bg-slate-400" : "bg-emerald-500"}`}
                      />
                      {session.kind === "agent" ? (
                        <span className={`flex items-center gap-1.5 ${AGENT_ACCENT_CLASSES[session.agent]}`}>
                          <AgentLogo agent={session.agent} className="h-4 w-4 shrink-0" />
                          <span>{label}</span>
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 text-slate-700">
                          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true" className="h-4 w-4 shrink-0">
                            <path d="M2.5 8h11M8 2.5v11M4.2 4.2l7.6 7.6M11.8 4.2l-7.6 7.6" />
                          </svg>
                          <span>{label}</span>
                        </span>
                      )}
                    </span>
                    <span className="mt-1 block truncate text-xs text-slate-500">
                      {project ? (
                        <ProjectChip
                          projectId={project.id}
                          name={project.name}
                          color={project.color}
                          className="inline-block max-w-full truncate align-middle"
                        />
                      ) : session.kind === "setup" ? "Remote access setup" : projectName}
                    </span>
                    <span className="mt-1 block text-xs text-slate-500">{exited ? "Exited" : "Live"}</span>
                  </button>
                  {exited && (
                    <button
                      type="button"
                      onClick={() => onDismiss(session.id)}
                      className="self-center rounded-md p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-3 focus:ring-sky-100"
                      aria-label={`Dismiss ${label} session`}
                    >
                      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" className="h-4 w-4">
                        <path d="m4 4 8 8M12 4l-8 8" />
                      </svg>
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}
