"use client";

import { ProjectChip } from "../project-chip";
import { getAgent, type AgentId } from "@/lib/agents";
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
          <ul className="space-y-1" aria-label="Open agent sessions">
            {sessions.map((session) => {
              const agent = getAgent(session.agent);
              const selected = session.id === selectedSessionId;
              const exited = session.state === "exited";
              const project = sessionProject(session.cwd, projects);
              const projectName = sessionLabel(session.cwd, project);
              const agentAccentClass = AGENT_ACCENT_CLASSES[session.agent];

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
                      <span className={`flex items-center gap-1.5 ${agentAccentClass}`}>
                        <AgentLogo agent={session.agent} className="h-4 w-4 shrink-0" />
                        <span>{agent.label}</span>
                      </span>
                    </span>
                    <span className="mt-1 block truncate text-xs text-slate-500">
                      {project ? (
                        <ProjectChip
                          projectId={project.id}
                          name={project.name}
                          color={project.color}
                          className="inline-block max-w-full truncate align-middle"
                        />
                      ) : projectName}
                    </span>
                    <span className="mt-1 block text-xs text-slate-500">{exited ? "Exited" : "Live"}</span>
                  </button>
                  {exited && (
                    <button
                      type="button"
                      onClick={() => onDismiss(session.id)}
                      className="self-center rounded-md p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-3 focus:ring-sky-100"
                      aria-label={`Dismiss ${agent.label} session in ${projectName}`}
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
