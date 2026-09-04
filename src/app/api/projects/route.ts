import { promises as fs } from "node:fs";
import path from "node:path";

import {
  ApplicationStoreError,
  ApplicationValidationError,
  createApplication,
  deleteProjectApplications,
  listApplications,
} from "@/lib/applications-store";
import { GitError, initializeGitRepository, isGitAvailable } from "@/lib/git";
import {
  createProject,
  deleteProject,
  listProjects,
  ProjectStoreError,
  ProjectValidationError,
} from "@/lib/projects-store";
import { readSettings, SettingsStoreError } from "@/lib/settings-store";

export const dynamic = "force-dynamic";

class ProjectCreationError extends Error {}

type ApplicationInput = { name: string; path: string };

export async function GET() {
  try {
    const [projects, applications] = await Promise.all([listProjects(), listApplications()]);
    return Response.json(
      projects.map((project) => ({
        ...project,
        applications: applications.filter((application) => application.projectId === project.id),
      })),
    );
  } catch (error) {
    console.error("Unable to list projects", error);
    const message = error instanceof ApplicationStoreError
      ? "Application data could not be read. Check data/applications.json and try again."
      : "Project data could not be read. Check data/projects.json and try again.";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  let projectId: string | null = null;
  let createdDirectory: string | null = null;
  try {
    const details = await projectInput(input);
    if (details.mode === "create") {
      createdDirectory = await createDirectory(details.path);
    }

    if (details.initializeGit) {
      if (!await isGitAvailable()) {
        throw new ProjectCreationError("Git is not available on this machine, so the repository cannot be initialized.");
      }
      await initializeGitRepository(details.path);
    }

    const project = await createProject({
      ...details.source,
      path: details.path,
      ...(details.slug ? { slug: details.slug } : {}),
    });
    projectId = project.id;

    const applications = uniqueApplicationNames(details.applications.length
      ? details.applications
      : [{ name: project.name, path: project.path }]);
    for (const application of applications) {
      await createApplication(project.id, application);
    }

    return Response.json(project, { status: 201 });
  } catch (error) {
    if (projectId) {
      try {
        await deleteProjectApplications(projectId);
        await deleteProject(projectId);
      } catch (rollbackError) {
        console.error("Unable to roll back project after application creation failed", rollbackError);
      }
    }
    if (createdDirectory) {
      try {
        await fs.rm(createdDirectory, { recursive: true, force: true });
      } catch (rollbackError) {
        console.error("Unable to remove newly created project directory", rollbackError);
      }
    }

    if (
      error instanceof ProjectCreationError ||
      error instanceof ProjectValidationError ||
      error instanceof ApplicationValidationError ||
      error instanceof GitError
    ) {
      return Response.json({ error: error.message }, { status: 400 });
    }

    const message = error instanceof SettingsStoreError
      ? "Project settings could not be read. Check data/settings.json and try again."
      : error instanceof ProjectStoreError
        ? "Project data could not be written. Check data/projects.json and try again."
        : error instanceof ApplicationStoreError
          ? "Application data could not be written. Check data/applications.json and try again."
          : "Unable to create the project. Try again.";
    console.error("Unable to create project", error);
    return Response.json({ error: message }, { status: 500 });
  }
}

async function projectInput(input: unknown): Promise<{
  source: Record<string, unknown>;
  mode: "create" | "existing" | "legacy";
  path: string;
  slug?: string;
  initializeGit: boolean;
  applications: ApplicationInput[];
}> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new ProjectCreationError("Project details must be an object.");
  }

  const source = input as Record<string, unknown>;
  const creationMode = source.creationMode;
  if (creationMode !== undefined && creationMode !== "create" && creationMode !== "existing") {
    throw new ProjectCreationError("Choose how to set up the project directory.");
  }

  const mode = creationMode ?? "legacy";
  let projectPath: string;
  let slug: string | undefined;
  if (mode === "create") {
    slug = readSlug(source.slug);
    const settings = await readSettings();
    if (!settings.defaultProjectPath) {
      throw new ProjectCreationError("Set a default project directory before creating a new directory.");
    }
    projectPath = safeProjectPath(settings.defaultProjectPath, slug);
  } else {
    if (typeof source.path !== "string" || !source.path.trim()) {
      throw new ProjectCreationError("Enter a working directory path.");
    }
    projectPath = path.resolve(source.path.trim());
    if (mode === "existing" && "slug" in source) {
      slug = readSlug(source.slug);
    }
  }

  if (typeof source.initializeGit !== "boolean" && source.initializeGit !== undefined) {
    throw new ProjectCreationError("Git initialization must be true or false.");
  }

  return {
    source,
    mode,
    path: projectPath,
    slug,
    initializeGit: source.initializeGit === true,
    applications: readApplications(source),
  };
}

function readSlug(value: unknown): string {
  if (typeof value !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.trim())) {
    throw new ProjectCreationError("The project slug must use lowercase letters, numbers, and hyphens.");
  }
  return value.trim();
}

function safeProjectPath(defaultProjectPath: string, slug: string): string {
  const root = path.resolve(defaultProjectPath);
  const target = path.resolve(root, slug);
  if (!target.startsWith(`${root}${path.sep}`)) {
    throw new ProjectCreationError("The project slug must stay inside the default project directory.");
  }
  return target;
}

function readApplications(source: Record<string, unknown>): ApplicationInput[] {
  if ("applications" in source) {
    if (!Array.isArray(source.applications)) {
      throw new ProjectCreationError("Applications must be a list.");
    }
    return source.applications.map((application) => {
      if (!application || typeof application !== "object" || Array.isArray(application)) {
        throw new ProjectCreationError("Each application must include a name and directory path.");
      }
      const item = application as Record<string, unknown>;
      if (typeof item.name !== "string" || typeof item.path !== "string") {
        throw new ProjectCreationError("Each application must include a name and directory path.");
      }
      return { name: item.name, path: item.path };
    });
  }

  if ("application" in source) {
    return [source.application as ApplicationInput];
  }
  return [];
}

function uniqueApplicationNames(applications: ApplicationInput[]): ApplicationInput[] {
  const usedNames = new Set<string>();

  return applications.map((application) => {
    const baseName = application.name.trim();
    let name = baseName;
    let index = 2;
    while (usedNames.has(name.toLocaleLowerCase())) {
      name = `${baseName}(${index})`;
      index += 1;
    }
    usedNames.add(name.toLocaleLowerCase());
    return { ...application, name };
  });
}

async function createDirectory(target: string): Promise<string> {
  const parent = path.dirname(target);
  try {
    if (!(await fs.stat(parent)).isDirectory()) {
      throw new ProjectCreationError("The default project directory must point to a directory.");
    }
  } catch (error) {
    if (error instanceof ProjectCreationError) {
      throw error;
    }
    throw new ProjectCreationError("The default project directory could not be accessed.");
  }

  try {
    await fs.mkdir(target, { recursive: false });
    return target;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      throw new ProjectCreationError("A directory with this name already exists.");
    }
    throw new ProjectCreationError("The project directory could not be created.");
  }
}
