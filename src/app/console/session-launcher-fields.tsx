"use client";

import Link from "next/link";

import { AGENTS, type AgentId } from "@/lib/agents";
import type { SessionProject } from "./session-project";

type Props = {
  projects: SessionProject[];
  isLoadingProjects: boolean;
  selectedProjectId: string;
  selectedApplicationId: string;
  agent: AgentId;
  onProjectChange: (projectId: string) => void;
  onApplicationChange: (applicationId: string) => void;
  onAgentChange: (agent: AgentId) => void;
};

export function SessionLauncherFields({
  projects,
  isLoadingProjects,
  selectedProjectId,
  selectedApplicationId,
  agent,
  onProjectChange,
  onApplicationChange,
  onAgentChange,
}: Props) {
  const selectedProject = projects.find((project) => project.id === selectedProjectId) ?? null;
  const hasApplications = Boolean(selectedProject?.applications.length);

  if (isLoadingProjects) {
    return <p className="pt-1 text-sm leading-6 text-slate-600">Loading saved projects…</p>;
  }

  if (projects.length === 0) {
    return (
      <p className="pt-1 text-sm leading-6 text-slate-600">
        Save a project before starting a session. <Link href="/projects/new" className="font-medium text-sky-700 transition hover:text-sky-900 focus:outline-none focus:ring-3 focus:ring-sky-100">Create a project</Link>.
      </p>
    );
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_12rem]">
        <div>
          <label className="block text-sm font-medium text-slate-800" htmlFor="project">Project</label>
          <select
            id="project"
            value={selectedProjectId}
            onChange={(event) => onProjectChange(event.target.value)}
            className="mt-2 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-sky-600 focus:ring-3 focus:ring-sky-100"
          >
            {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-800" htmlFor="application">Application</label>
          <select
            id="application"
            value={selectedApplicationId}
            onChange={(event) => onApplicationChange(event.target.value)}
            className="mt-2 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-sky-600 focus:ring-3 focus:ring-sky-100"
          >
            {hasApplications ? (
              selectedProject!.applications.map((application) => (
                <option key={application.id} value={application.id}>{application.name}</option>
              ))
            ) : (
              <option value="">Project path (fallback — no applications)</option>
            )}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-800" htmlFor="agent">Agent</label>
          <select
            id="agent"
            value={agent}
            onChange={(event) => onAgentChange(event.target.value as AgentId)}
            className="mt-2 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-sky-600 focus:ring-3 focus:ring-sky-100"
          >
            {AGENTS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
          </select>
        </div>
      </div>
      {!hasApplications && selectedProject && (
        <p className="text-sm leading-6 text-slate-600">
          This project has no applications, so the session will use its project directory. <Link href={`/projects/${selectedProject.id}`} className="font-medium text-sky-700 transition hover:text-sky-900 focus:outline-none focus:ring-3 focus:ring-sky-100">Add an application</Link> to choose a codebase directly.
        </p>
      )}
    </>
  );
}
