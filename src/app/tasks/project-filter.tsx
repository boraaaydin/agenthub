"use client";

import { useRouter } from "next/navigation";

type ProjectFilterProps = {
  projects: { id: string; name: string }[];
  selectedProjectId: string;
};

export function ProjectFilter({ projects, selectedProjectId }: ProjectFilterProps) {
  const router = useRouter();

  function changeProject(projectId: string) {
    const searchParams = new URLSearchParams();
    if (projectId) {
      searchParams.set("project", projectId);
    }
    searchParams.delete("page");

    const query = searchParams.toString();
    router.push(query ? `/tasks?${query}` : "/tasks");
  }

  return (
    <div className="sm:max-w-xs">
      <label className="block text-sm font-medium text-slate-800" htmlFor="project-filter">
        Project
      </label>
      <select
        id="project-filter"
        value={selectedProjectId}
        onChange={(event) => changeProject(event.target.value)}
        className="mt-2 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-sky-600 focus:ring-3 focus:ring-sky-100"
      >
        <option value="">All projects</option>
        {projects.map((project) => (
          <option key={project.id} value={project.id}>{project.name}</option>
        ))}
      </select>
    </div>
  );
}
