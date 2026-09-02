import "server-only";

import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

import { isProjectColorToken, type ProjectColorToken } from "./project-colors";

export type Project = {
  id: string;
  name: string;
  path: string;
  createdAt: string;
  color?: ProjectColorToken;
};

type ProjectsDocument = {
  projects: Project[];
};

export const PROJECTS_FILE_PATH = path.join(process.cwd(), "data", "projects.json");

let writeQueue: Promise<void> = Promise.resolve();

export class ProjectValidationError extends Error {}

export class ProjectStoreError extends Error {}

function isProject(value: unknown): value is Project {
  if (!value || typeof value !== "object") {
    return false;
  }

  const project = value as Record<string, unknown>;
  return (
    typeof project.id === "string" &&
    typeof project.name === "string" &&
    typeof project.path === "string" &&
    typeof project.createdAt === "string" &&
    (!("color" in project) || isProjectColorToken(project.color))
  );
}

function isProjectRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object") {
    return false;
  }

  const project = value as Record<string, unknown>;
  return (
    typeof project.id === "string" &&
    typeof project.name === "string" &&
    typeof project.path === "string" &&
    typeof project.createdAt === "string"
  );
}

function normalizeProject(project: Record<string, unknown>): Project {
  const normalized = {
    id: project.id as string,
    name: project.name as string,
    path: project.path as string,
    createdAt: project.createdAt as string,
  };
  return isProject(project) ? { ...normalized, ...(project.color ? { color: project.color } : {}) } : normalized;
}

function parseDocument(value: unknown): ProjectsDocument {
  if (!value || typeof value !== "object" || !("projects" in value)) {
    throw new ProjectStoreError(`Project data in ${PROJECTS_FILE_PATH} has an invalid format.`);
  }

  const { projects } = value as { projects: unknown };
  if (!Array.isArray(projects) || !projects.every(isProjectRecord)) {
    throw new ProjectStoreError(`Project data in ${PROJECTS_FILE_PATH} has an invalid format.`);
  }

  return { projects: projects.map(normalizeProject) };
}

async function readDocument(): Promise<ProjectsDocument> {
  let contents: string;
  try {
    contents = await fs.readFile(PROJECTS_FILE_PATH, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { projects: [] };
    }
    throw new ProjectStoreError(`Unable to read project data from ${PROJECTS_FILE_PATH}.`);
  }

  try {
    return parseDocument(JSON.parse(contents) as unknown);
  } catch (error) {
    if (error instanceof ProjectStoreError) {
      throw error;
    }
    throw new ProjectStoreError(`Project data in ${PROJECTS_FILE_PATH} is not valid JSON.`);
  }
}

async function writeDocument(document: ProjectsDocument): Promise<void> {
  await fs.mkdir(path.dirname(PROJECTS_FILE_PATH), { recursive: true });
  await fs.writeFile(
    PROJECTS_FILE_PATH,
    `${JSON.stringify(document, null, 2)}\n`,
    "utf8",
  );
}

function serializeWrite<T>(operation: () => Promise<T>): Promise<T> {
  const result = writeQueue.then(operation, operation);
  writeQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

type ProjectDetails = { name: string; path: string; color?: ProjectColorToken | null };

function projectDetails(input: unknown): ProjectDetails {
  if (!input || typeof input !== "object") {
    throw new ProjectValidationError("Name and working directory are required.");
  }

  const details = input as Record<string, unknown>;
  const { name, path: projectPath } = details;
  if (typeof name !== "string" || !name.trim()) {
    throw new ProjectValidationError("Enter a project name.");
  }
  if (typeof projectPath !== "string" || !projectPath.trim()) {
    throw new ProjectValidationError("Enter a working directory path.");
  }

  const normalized = { name: name.trim(), path: path.resolve(projectPath.trim()) };
  if (!("color" in details) || details.color === undefined) {
    return normalized;
  }
  if (details.color === null || details.color === "") {
    return { ...normalized, color: null };
  }
  if (isProjectColorToken(details.color)) {
    return { ...normalized, color: details.color };
  }
  throw new ProjectValidationError("Choose a color from the palette.");
}

async function validateDirectory(projectPath: string): Promise<void> {
  try {
    const stats = await fs.stat(projectPath);
    if (!stats.isDirectory()) {
      throw new ProjectValidationError("The working directory path must point to a directory.");
    }
  } catch (error) {
    if (error instanceof ProjectValidationError) {
      throw error;
    }
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new ProjectValidationError("The working directory does not exist.");
    }
    throw new ProjectValidationError("The working directory could not be accessed.");
  }
}

export async function listProjects(): Promise<Project[]> {
  const { projects } = await readDocument();
  return projects;
}

export async function getProject(id: string): Promise<Project | null> {
  const { projects } = await readDocument();
  return projects.find((project) => project.id === id) ?? null;
}

export async function createProject(input: unknown): Promise<Project> {
  const details = projectDetails(input);
  await validateDirectory(details.path);

  return serializeWrite(async () => {
    const document = await readDocument();
    const project: Project = {
      id: randomUUID(),
      name: details.name,
      path: details.path,
      createdAt: new Date().toISOString(),
      ...(details.color ? { color: details.color } : {}),
    };

    document.projects.push(project);
    await writeDocument(document);
    return project;
  });
}

export async function updateProject(inputId: string, input: unknown): Promise<Project | null> {
  const details = projectDetails(input);
  await validateDirectory(details.path);

  return serializeWrite(async () => {
    const document = await readDocument();
    const project = document.projects.find((candidate) => candidate.id === inputId);
    if (!project) {
      return null;
    }

    project.name = details.name;
    project.path = details.path;
    if (details.color === null) {
      delete project.color;
    } else if (details.color) {
      project.color = details.color;
    }
    await writeDocument(document);
    return project;
  });
}

export async function deleteProject(id: string): Promise<Project | null> {
  return serializeWrite(async () => {
    const document = await readDocument();
    const index = document.projects.findIndex((project) => project.id === id);
    if (index === -1) {
      return null;
    }

    const [deletedProject] = document.projects.splice(index, 1);
    await writeDocument(document);
    return deletedProject;
  });
}
