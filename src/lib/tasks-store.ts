import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";

export type Task = {
  id: number;
  projectId: string;
  title: string;
  detail: string;
  createdAt: string;
  updatedAt: string;
};

type TasksDocument = {
  tasks: Task[];
};

type PaginationInput = {
  page: number;
  pageSize: number;
};

export type PaginatedTasks = {
  tasks: Task[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export const TASKS_FILE_PATH = path.join(process.cwd(), "data", "tasks.json");
export const TASKS_PAGE_SIZE = 10;

let writeQueue: Promise<void> = Promise.resolve();

export class TaskValidationError extends Error {}

export class TaskStoreError extends Error {}

function isTask(value: unknown): value is Task {
  if (!value || typeof value !== "object") {
    return false;
  }

  const task = value as Record<string, unknown>;
  return (
    typeof task.id === "number" &&
    Number.isInteger(task.id) &&
    task.id > 0 &&
    typeof task.projectId === "string" &&
    typeof task.title === "string" &&
    typeof task.detail === "string" &&
    typeof task.createdAt === "string" &&
    typeof task.updatedAt === "string"
  );
}

function parseDocument(value: unknown): TasksDocument {
  if (!value || typeof value !== "object" || !("tasks" in value)) {
    throw new TaskStoreError(`Task data in ${TASKS_FILE_PATH} has an invalid format.`);
  }

  const { tasks } = value as { tasks: unknown };
  if (!Array.isArray(tasks) || !tasks.every(isTask)) {
    throw new TaskStoreError(`Task data in ${TASKS_FILE_PATH} has an invalid format.`);
  }

  return { tasks };
}

async function readDocument(): Promise<TasksDocument> {
  let contents: string;
  try {
    contents = await fs.readFile(TASKS_FILE_PATH, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { tasks: [] };
    }
    throw new TaskStoreError(`Unable to read task data from ${TASKS_FILE_PATH}.`);
  }

  try {
    return parseDocument(JSON.parse(contents) as unknown);
  } catch (error) {
    if (error instanceof TaskStoreError) {
      throw error;
    }
    throw new TaskStoreError(`Task data in ${TASKS_FILE_PATH} is not valid JSON.`);
  }
}

async function writeDocument(document: TasksDocument): Promise<void> {
  await fs.mkdir(path.dirname(TASKS_FILE_PATH), { recursive: true });
  await fs.writeFile(TASKS_FILE_PATH, `${JSON.stringify(document, null, 2)}\n`, "utf8");
}

function serializeWrite<T>(operation: () => Promise<T>): Promise<T> {
  const result = writeQueue.then(operation, operation);
  writeQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

function taskDetails(input: unknown): { title: string; detail: string } {
  if (!input || typeof input !== "object") {
    throw new TaskValidationError("A task title and detail are required.");
  }

  const { title, detail } = input as Record<string, unknown>;
  if (typeof title !== "string" || !title.trim()) {
    throw new TaskValidationError("Enter a task title.");
  }
  if (typeof detail !== "string") {
    throw new TaskValidationError("Enter task details.");
  }

  return { title: title.trim(), detail };
}

function normalizePage(page: number): number {
  return Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1;
}

function normalizePageSize(pageSize: number): number {
  return Number.isFinite(pageSize) && pageSize >= 1 ? Math.floor(pageSize) : TASKS_PAGE_SIZE;
}

function paginateTasks(
  tasks: Task[],
  { page, pageSize, projectId }: PaginationInput & { projectId?: string },
): PaginatedTasks {
  const normalizedPage = normalizePage(page);
  const normalizedPageSize = normalizePageSize(pageSize);
  const filteredTasks = tasks
    .filter((task) => projectId === undefined || task.projectId === projectId)
    .sort((first, second) => second.createdAt.localeCompare(first.createdAt));
  const total = filteredTasks.length;

  return {
    tasks: filteredTasks.slice((normalizedPage - 1) * normalizedPageSize, normalizedPage * normalizedPageSize),
    page: normalizedPage,
    pageSize: normalizedPageSize,
    total,
    totalPages: Math.ceil(total / normalizedPageSize),
  };
}

export async function listProjectTasks(
  projectId: string,
  { page, pageSize }: PaginationInput,
): Promise<PaginatedTasks> {
  const { tasks } = await readDocument();
  return paginateTasks(tasks, { page, pageSize, projectId });
}

export async function listAllTasks(
  { page, pageSize, projectId }: PaginationInput & { projectId?: string },
): Promise<PaginatedTasks> {
  const { tasks } = await readDocument();
  return paginateTasks(tasks, { page, pageSize, projectId });
}

export async function getTask(projectId: string, taskId: number): Promise<Task | null> {
  const { tasks } = await readDocument();
  return tasks.find((task) => task.projectId === projectId && task.id === taskId) ?? null;
}

export async function createTask(projectId: string, input: unknown): Promise<Task> {
  const details = taskDetails(input);

  return serializeWrite(async () => {
    const document = await readDocument();
    const now = new Date().toISOString();
    const nextId = document.tasks
      .reduce((highest, task) => Math.max(highest, task.id), 0) + 1;
    const task: Task = {
      id: nextId,
      projectId,
      title: details.title,
      detail: details.detail,
      createdAt: now,
      updatedAt: now,
    };

    document.tasks.push(task);
    await writeDocument(document);
    return task;
  });
}

export async function updateTask(projectId: string, taskId: number, input: unknown): Promise<Task | null> {
  const details = taskDetails(input);

  return serializeWrite(async () => {
    const document = await readDocument();
    const task = document.tasks.find((candidate) => candidate.projectId === projectId && candidate.id === taskId);
    if (!task) {
      return null;
    }

    task.title = details.title;
    task.detail = details.detail;
    task.updatedAt = new Date().toISOString();
    await writeDocument(document);
    return task;
  });
}

export async function deleteTask(projectId: string, taskId: number): Promise<Task | null> {
  return serializeWrite(async () => {
    const document = await readDocument();
    const index = document.tasks.findIndex((task) => task.projectId === projectId && task.id === taskId);
    if (index === -1) {
      return null;
    }

    const [deletedTask] = document.tasks.splice(index, 1);
    await writeDocument(document);
    return deletedTask;
  });
}

export async function countProjectTasks(projectId: string): Promise<number> {
  const { tasks } = await readDocument();
  return tasks.filter((task) => task.projectId === projectId).length;
}

export async function deleteProjectTasks(projectId: string): Promise<number> {
  return serializeWrite(async () => {
    const document = await readDocument();
    const remainingTasks = document.tasks.filter((task) => task.projectId !== projectId);
    const deletedCount = document.tasks.length - remainingTasks.length;
    if (deletedCount === 0) {
      return 0;
    }

    document.tasks = remainingTasks;
    await writeDocument(document);
    return deletedCount;
  });
}
