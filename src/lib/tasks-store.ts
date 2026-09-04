import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";

import { ensureDataMigrated } from "./data-migration";
import { appendLifecycleEvent } from "./lifecycle-log-store";
import {
  DEFAULT_TASK_STATUS,
  isTaskStatus,
  TASK_STATUSES as TASK_STATUS_VALUES,
  type TaskStatus,
} from "./task-filters";

export type { TaskStatus } from "./task-filters";
export const TASK_STATUSES = TASK_STATUS_VALUES;

export type Task = {
  id: number;
  projectId: string;
  workitemId: number;
  title: string;
  filePath: string;
  summary: string;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
};

// Older persisted tasks used the former terminal status. Keep accepting it while
// normalizing every read to the current completed status.
const LEGACY_COMPLETED_STATUS = ["cl", "osed"].join("");
const LEGACY_REGISTERED_STATUS = "registered";

type StoredTask = Omit<Task, "status" | "updatedAt"> & {
  status?: string;
  updatedAt?: string;
};

type TasksDocument = {
  tasks: StoredTask[];
};

type PaginationInput = {
  page: number;
  pageSize: number;
  projectId?: string;
  statuses?: readonly TaskStatus[];
  excludedWorkitemKeys?: ReadonlySet<string>;
};

export type PaginatedTasks = {
  tasks: Task[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type LatestTasksByWorkitem = Map<string, { task: Task; taskCount: number }>;

export const TASKS_FILE_PATH = path.join(process.cwd(), "data", "tasks.json");
export const TASKS_PAGE_SIZE = 10;

let writeQueue: Promise<void> = Promise.resolve();

export class TaskValidationError extends Error {}

export class TaskStoreError extends Error {}

function isTask(value: unknown): value is StoredTask {
  if (!value || typeof value !== "object") {
    return false;
  }

  const task = value as Record<string, unknown>;
  return (
    typeof task.id === "number" &&
    Number.isInteger(task.id) &&
    task.id > 0 &&
    typeof task.projectId === "string" &&
    Boolean(task.projectId.trim()) &&
    typeof task.workitemId === "number" &&
    Number.isInteger(task.workitemId) &&
    task.workitemId > 0 &&
    typeof task.title === "string" &&
    Boolean(task.title.trim()) &&
    typeof task.filePath === "string" &&
    Boolean(task.filePath.trim()) &&
    typeof task.summary === "string" &&
    (task.status === undefined || isTaskStatus(task.status) || task.status === LEGACY_COMPLETED_STATUS || task.status === LEGACY_REGISTERED_STATUS) &&
    typeof task.createdAt === "string" &&
    (task.updatedAt === undefined || typeof task.updatedAt === "string")
  );
}

function normalizeTask(task: StoredTask): Task {
  const status = task.status === LEGACY_COMPLETED_STATUS
    ? "completed"
    : task.status === LEGACY_REGISTERED_STATUS
      ? "created"
    : isTaskStatus(task.status)
      ? task.status
      : DEFAULT_TASK_STATUS;

  return {
    ...task,
    status,
    updatedAt: task.updatedAt ?? task.createdAt,
  };
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
  try {
    await ensureDataMigrated();
  } catch {
    throw new TaskStoreError(`Unable to migrate task data; check ${TASKS_FILE_PATH}.`);
  }
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

function taskDetails(input: unknown): Omit<Task, "id" | "status" | "createdAt" | "updatedAt"> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new TaskValidationError("Task details are required.");
  }

  const { projectId, workitemId, title, filePath, summary } = input as Record<string, unknown>;
  if (typeof projectId !== "string" || !projectId.trim()) {
    throw new TaskValidationError("Enter a project ID.");
  }

  const normalizedWorkitemId = typeof workitemId === "number"
    ? workitemId
    : typeof workitemId === "string" && /^\d+$/.test(workitemId) && String(Number(workitemId)) === workitemId
      ? Number(workitemId)
      : Number.NaN;
  if (!Number.isInteger(normalizedWorkitemId) || normalizedWorkitemId <= 0) {
    throw new TaskValidationError("Enter a positive workitem ID.");
  }
  if (typeof title !== "string" || !title.trim()) {
    throw new TaskValidationError("Enter a task title.");
  }
  if (typeof filePath !== "string" || !filePath.trim()) {
    throw new TaskValidationError("Enter a task file path.");
  }
  if (summary !== undefined && typeof summary !== "string") {
    throw new TaskValidationError("Task summary must be a string.");
  }

  return {
    projectId: projectId.trim(),
    workitemId: normalizedWorkitemId,
    title: title.trim(),
    filePath: filePath.trim(),
    summary: summary ?? "",
  };
}

export type TaskPatch = Partial<Pick<Task, "projectId" | "workitemId" | "title" | "filePath" | "summary" | "status">>;

export function taskPatch(input: unknown): TaskPatch {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new TaskValidationError("Provide at least one task field.");
  }

  const values = input as Record<string, unknown>;
  const patch: TaskPatch = {};

  if (Object.hasOwn(values, "projectId")) {
    if (typeof values.projectId !== "string" || !values.projectId.trim()) {
      throw new TaskValidationError("Enter a project ID.");
    }
    patch.projectId = values.projectId.trim();
  }
  if (Object.hasOwn(values, "workitemId")) {
    const workitemId = typeof values.workitemId === "number"
      ? values.workitemId
      : typeof values.workitemId === "string" && /^\d+$/.test(values.workitemId) && String(Number(values.workitemId)) === values.workitemId
        ? Number(values.workitemId)
        : Number.NaN;
    if (!Number.isInteger(workitemId) || workitemId <= 0) {
      throw new TaskValidationError("Enter a positive workitem ID.");
    }
    patch.workitemId = workitemId;
  }
  if (Object.hasOwn(values, "title")) {
    if (typeof values.title !== "string" || !values.title.trim()) {
      throw new TaskValidationError("Enter a task title.");
    }
    patch.title = values.title.trim();
  }
  if (Object.hasOwn(values, "filePath")) {
    if (typeof values.filePath !== "string" || !values.filePath.trim()) {
      throw new TaskValidationError("Enter a task file path.");
    }
    patch.filePath = values.filePath.trim();
  }
  if (Object.hasOwn(values, "summary")) {
    if (typeof values.summary !== "string") {
      throw new TaskValidationError("Task summary must be a string.");
    }
    patch.summary = values.summary;
  }
  if (Object.hasOwn(values, "status")) {
    if (!isTaskStatus(values.status)) {
      throw new TaskValidationError("Select a valid task status.");
    }
    patch.status = values.status;
  }

  if (Object.keys(patch).length === 0) {
    throw new TaskValidationError("Provide at least one task field.");
  }

  return patch;
}

function normalizePage(page: number): number {
  return Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1;
}

function normalizePageSize(pageSize: number): number {
  return Number.isFinite(pageSize) && pageSize >= 1 ? Math.floor(pageSize) : TASKS_PAGE_SIZE;
}

export async function createTask(input: unknown): Promise<Task> {
  const details = taskDetails(input);

  return serializeWrite(async () => {
    const document = await readDocument();
    const now = new Date().toISOString();
    const task: Task = {
      id: document.tasks.reduce((highest, candidate) => Math.max(highest, candidate.id), 0) + 1,
      ...details,
      status: DEFAULT_TASK_STATUS,
      createdAt: now,
      updatedAt: now,
    };
    document.tasks.push(task);
    await writeDocument(document);
    await appendLifecycleEvent({
      entityType: "task",
      entityId: task.id,
      projectId: task.projectId,
      fromStatus: null,
      toStatus: task.status,
      createdAt: now,
    });
    return task;
  });
}

export async function getTask(taskId: number): Promise<Task | null> {
  const { tasks } = await readDocument();
  const task = tasks.find((candidate) => candidate.id === taskId);
  return task ? normalizeTask(task) : null;
}

export async function updateTask(taskId: number, input: unknown): Promise<Task | null> {
  const patch = taskPatch(input);

  return serializeWrite(async () => {
    const document = await readDocument();
    const task = document.tasks.find((candidate) => candidate.id === taskId);
    if (!task) {
      return null;
    }

    const previousStatus = normalizeTask(task).status;
    const statusChanged = patch.status !== undefined && patch.status !== previousStatus;
    if (task.status === LEGACY_COMPLETED_STATUS) {
      task.status = "completed";
    }
    const now = new Date().toISOString();
    Object.assign(task, patch, { updatedAt: now });
    await writeDocument(document);
    const updatedTask = normalizeTask(task);
    if (statusChanged) {
      await appendLifecycleEvent({
        entityType: "task",
        entityId: updatedTask.id,
        projectId: updatedTask.projectId,
        fromStatus: previousStatus,
        toStatus: updatedTask.status,
        createdAt: now,
      });
    }
    return updatedTask;
  });
}

export async function deleteTask(taskId: number): Promise<Task | null> {
  return serializeWrite(async () => {
    const document = await readDocument();
    const index = document.tasks.findIndex((candidate) => candidate.id === taskId);
    if (index === -1) {
      return null;
    }

    const [deletedTask] = document.tasks.splice(index, 1);
    await writeDocument(document);
    return normalizeTask(deletedTask);
  });
}

export function taskWorkitemKey(projectId: string, workitemId: number): string {
  return `${projectId}:${workitemId}`;
}

export async function listLatestTasksByWorkitem(): Promise<LatestTasksByWorkitem> {
  const { tasks } = await readDocument();
  const latestTasksByWorkitem: LatestTasksByWorkitem = new Map();

  for (const task of tasks.map(normalizeTask)) {
    const key = taskWorkitemKey(task.projectId, task.workitemId);
    const current = latestTasksByWorkitem.get(key);

    if (!current) {
      latestTasksByWorkitem.set(key, { task, taskCount: 1 });
      continue;
    }

    latestTasksByWorkitem.set(key, {
      task: task.createdAt >= current.task.createdAt ? task : current.task,
      taskCount: current.taskCount + 1,
    });
  }

  return latestTasksByWorkitem;
}

export async function listTasksForWorkitem(projectId: string, workitemId: number): Promise<Task[]> {
  const { tasks } = await readDocument();
  return tasks
    .map(normalizeTask)
    .filter((task) => task.projectId === projectId && task.workitemId === workitemId);
}

export async function deleteTasksForWorkitem(projectId: string, workitemId: number): Promise<Task[]> {
  return serializeWrite(async () => {
    const document = await readDocument();
    const deletedTasks: Task[] = [];
    const remainingTasks = document.tasks.filter((task) => {
      if (task.projectId === projectId && task.workitemId === workitemId) {
        deletedTasks.push(normalizeTask(task));
        return false;
      }
      return true;
    });

    if (deletedTasks.length === 0) {
      return deletedTasks;
    }

    document.tasks = remainingTasks;
    await writeDocument(document);
    return deletedTasks;
  });
}

export async function listAllTasks({ page, pageSize, projectId, statuses, excludedWorkitemKeys }: PaginationInput): Promise<PaginatedTasks> {
  const { tasks } = await readDocument();
  const normalizedPage = normalizePage(page);
  const normalizedPageSize = normalizePageSize(pageSize);
  const filteredTasks = tasks
    .map(normalizeTask)
    .filter((task) => projectId === undefined || task.projectId === projectId)
    .filter((task) => statuses === undefined || statuses.includes(task.status))
    .filter((task) => !excludedWorkitemKeys?.has(taskWorkitemKey(task.projectId, task.workitemId)))
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
