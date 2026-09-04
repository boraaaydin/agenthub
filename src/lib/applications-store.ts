import "server-only";

import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

export type Application = {
  id: string;
  projectId: string;
  name: string;
  path: string;
  createdAt: string;
  updatedAt: string;
};

type ApplicationsDocument = {
  applications: Application[];
};

export const APPLICATIONS_FILE_PATH = path.join(process.cwd(), "data", "applications.json");

let writeQueue: Promise<void> = Promise.resolve();

export class ApplicationValidationError extends Error {}

export class ApplicationStoreError extends Error {}

function isApplication(value: unknown): value is Application {
  if (!value || typeof value !== "object") {
    return false;
  }

  const application = value as Record<string, unknown>;
  return (
    typeof application.id === "string" &&
    typeof application.projectId === "string" &&
    typeof application.name === "string" &&
    typeof application.path === "string" &&
    typeof application.createdAt === "string" &&
    typeof application.updatedAt === "string"
  );
}

function parseDocument(value: unknown): ApplicationsDocument {
  if (!value || typeof value !== "object" || !("applications" in value)) {
    throw new ApplicationStoreError(`Application data in ${APPLICATIONS_FILE_PATH} has an invalid format.`);
  }

  const { applications } = value as { applications: unknown };
  if (!Array.isArray(applications) || !applications.every(isApplication)) {
    throw new ApplicationStoreError(`Application data in ${APPLICATIONS_FILE_PATH} has an invalid format.`);
  }

  return { applications };
}

async function readDocument(): Promise<ApplicationsDocument> {
  let contents: string;
  try {
    contents = await fs.readFile(APPLICATIONS_FILE_PATH, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { applications: [] };
    }
    throw new ApplicationStoreError(`Unable to read application data from ${APPLICATIONS_FILE_PATH}.`);
  }

  try {
    return parseDocument(JSON.parse(contents) as unknown);
  } catch (error) {
    if (error instanceof ApplicationStoreError) {
      throw error;
    }
    throw new ApplicationStoreError(`Application data in ${APPLICATIONS_FILE_PATH} is not valid JSON.`);
  }
}

async function writeDocument(document: ApplicationsDocument): Promise<void> {
  await fs.mkdir(path.dirname(APPLICATIONS_FILE_PATH), { recursive: true });
  await fs.writeFile(
    APPLICATIONS_FILE_PATH,
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

type ApplicationDetails = {
  name: string;
  path: string;
};

function applicationDetails(input: unknown): ApplicationDetails {
  if (!input || typeof input !== "object") {
    throw new ApplicationValidationError("Application name and working directory are required.");
  }

  const details = input as Record<string, unknown>;
  const { name, path: applicationPath } = details;
  if (typeof name !== "string" || !name.trim()) {
    throw new ApplicationValidationError("Enter an application name.");
  }
  if (typeof applicationPath !== "string" || !applicationPath.trim()) {
    throw new ApplicationValidationError("Enter an application working directory path.");
  }

  return {
    name: name.trim(),
    path: path.resolve(applicationPath.trim()),
  };
}

async function validateDirectory(applicationPath: string): Promise<void> {
  try {
    const stats = await fs.stat(applicationPath);
    if (!stats.isDirectory()) {
      throw new ApplicationValidationError("The application working directory path must point to a directory.");
    }
  } catch (error) {
    if (error instanceof ApplicationValidationError) {
      throw error;
    }
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new ApplicationValidationError("The application working directory does not exist.");
    }
    throw new ApplicationValidationError("The application working directory could not be accessed.");
  }
}

function ensureUniqueName(
  applications: Application[],
  projectId: string,
  name: string,
  applicationId?: string,
) {
  const duplicate = applications.some(
    (application) =>
      application.projectId === projectId &&
      application.id !== applicationId &&
      application.name.toLocaleLowerCase() === name.toLocaleLowerCase(),
  );
  if (duplicate) {
    throw new ApplicationValidationError("An application with this name already exists in this project.");
  }
}

export async function listApplications(): Promise<Application[]> {
  const { applications } = await readDocument();
  return applications;
}

export async function listProjectApplications(projectId: string): Promise<Application[]> {
  const { applications } = await readDocument();
  return applications.filter((application) => application.projectId === projectId);
}

export async function getApplication(id: string): Promise<Application | null> {
  const { applications } = await readDocument();
  return applications.find((application) => application.id === id) ?? null;
}

export async function createApplication(projectId: string, input: unknown): Promise<Application> {
  const details = applicationDetails(input);
  await validateDirectory(details.path);

  return serializeWrite(async () => {
    const document = await readDocument();
    ensureUniqueName(document.applications, projectId, details.name);

    const timestamp = new Date().toISOString();
    const application: Application = {
      id: randomUUID(),
      projectId,
      name: details.name,
      path: details.path,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    document.applications.push(application);
    await writeDocument(document);
    return application;
  });
}

export async function updateApplication(id: string, input: unknown): Promise<Application | null> {
  const details = applicationDetails(input);
  await validateDirectory(details.path);

  return serializeWrite(async () => {
    const document = await readDocument();
    const application = document.applications.find((candidate) => candidate.id === id);
    if (!application) {
      return null;
    }

    ensureUniqueName(document.applications, application.projectId, details.name, id);
    application.name = details.name;
    application.path = details.path;
    application.updatedAt = new Date().toISOString();
    await writeDocument(document);
    return application;
  });
}

export async function deleteApplication(id: string): Promise<Application | null> {
  return serializeWrite(async () => {
    const document = await readDocument();
    const index = document.applications.findIndex((application) => application.id === id);
    if (index === -1) {
      return null;
    }

    const application = document.applications[index];
    const projectApplications = document.applications.filter(
      (candidate) => candidate.projectId === application.projectId,
    );
    if (projectApplications.length <= 1) {
      throw new ApplicationValidationError("A project must keep at least one application. Add another application before deleting this one.");
    }

    const [deletedApplication] = document.applications.splice(index, 1);
    await writeDocument(document);
    return deletedApplication;
  });
}

export async function deleteProjectApplications(projectId: string): Promise<void> {
  await serializeWrite(async () => {
    const document = await readDocument();
    document.applications = document.applications.filter(
      (application) => application.projectId !== projectId,
    );
    await writeDocument(document);
  });
}
