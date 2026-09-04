export type SessionApplication = {
  id: string;
  name: string;
  path: string;
};

export type SessionProject = {
  id: string;
  name: string;
  path: string;
  color?: string;
  applications: SessionApplication[];
};

export type ResolvedSessionProject = {
  project: SessionProject | null;
  application: SessionApplication | null;
};

export function resolveSessionProject(
  cwd: string,
  projects: SessionProject[],
): ResolvedSessionProject {
  for (const project of projects) {
    const application = project.applications.find((candidate) => candidate.path === cwd);
    if (application) {
      return { project, application };
    }
  }

  const project = projects.find((candidate) => candidate.path === cwd) ?? null;
  return { project, application: null };
}

export function sessionPathLabel(cwd: string, project: SessionProject | null): string {
  return project?.name ?? cwd.split("/").filter(Boolean).at(-1) ?? cwd;
}
