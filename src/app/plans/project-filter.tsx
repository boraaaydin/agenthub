"use client";

import { useRouter } from "next/navigation";

import { plansHref } from "@/lib/plan-filters";

type ProjectFilterProps = {
  projects: { id: string; name: string }[];
  selectedProjectId: string;
};

export function ProjectFilter({ projects, selectedProjectId }: ProjectFilterProps) {
  const router = useRouter();

  return (
    <div className="sm:max-w-xs">
      <label className="block text-sm font-medium text-slate-800" htmlFor="plan-project-filter">Project</label>
      <select
        id="plan-project-filter"
        value={selectedProjectId}
        onChange={(event) => router.push(plansHref({ projectId: event.target.value }))}
        className="mt-2 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-sky-600 focus:ring-3 focus:ring-sky-100"
      >
        <option value="">All projects</option>
        {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
      </select>
    </div>
  );
}
