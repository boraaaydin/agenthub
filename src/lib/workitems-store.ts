import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";

import {
  DEFAULT_WORKITEM_STATUS,
  isWorkitemStatus,
  WORKITEM_STATUSES as WORKITEM_STATUS_VALUES,
  type WorkitemStatus,
} from "./workitem-filters";
import { ensureDataMigrated } from "./data-migration";
import { appendLifecycleEvent } from "./lifecycle-log-store";
import { publishWorkitemChange } from "./workitem-events";

export type { WorkitemStatus } from "./workitem-filters";
export const WORKITEM_STATUSES = WORKITEM_STATUS_VALUES;

export type Workitem = {
  id: number;
  projectId: string;
  title: string;
  detail: string;
  status: WorkitemStatus;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type StoredWorkitem = Omit<Workitem, "status" | "completedAt"> & {
  status?: WorkitemStatus | "plan_creating" | "plan_created";
  completedAt?: string | null;
};

type WorkitemsDocument = {
  workitems: StoredWorkitem[];
};

type PaginationInput = {
  page: number;
  pageSize: number;
};

export type PaginatedWorkitems = {
  workitems: Workitem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export const WORKITEMS_FILE_PATH = path.join(process.cwd(), "data", "workitems.json");
export const WORKITEMS_PAGE_SIZE = 10;

let writeQueue: Promise<void> = Promise.resolve();

export class WorkitemValidationError extends Error {}

export class WorkitemStoreError extends Error {}

function isWorkitem(value: unknown): value is StoredWorkitem {
  if (!value || typeof value !== "object") {
    return false;
  }

  const workitem = value as Record<string, unknown>;
  return (
    typeof workitem.id === "number" &&
    Number.isInteger(workitem.id) &&
    workitem.id > 0 &&
    typeof workitem.projectId === "string" &&
    typeof workitem.title === "string" &&
    typeof workitem.detail === "string" &&
    typeof workitem.createdAt === "string" &&
    typeof workitem.updatedAt === "string" &&
    (workitem.status === undefined || isWorkitemStatus(workitem.status) || workitem.status === "plan_creating" || workitem.status === "plan_created") &&
    (workitem.completedAt === undefined || workitem.completedAt === null || typeof workitem.completedAt === "string")
  );
}

function normalizeWorkitem(workitem: StoredWorkitem): Workitem {
  return {
    ...workitem,
    status: workitem.status === "plan_creating"
      ? "task_creating"
      : workitem.status === "plan_created"
        ? "task_created"
        : workitem.status ?? DEFAULT_WORKITEM_STATUS,
    completedAt: workitem.completedAt ?? null,
  };
}

function parseDocument(value: unknown): WorkitemsDocument {
  if (!value || typeof value !== "object" || !("workitems" in value)) {
    throw new WorkitemStoreError(`Workitem data in ${WORKITEMS_FILE_PATH} has an invalid format.`);
  }

  const { workitems } = value as { workitems: unknown };
  if (!Array.isArray(workitems) || !workitems.every(isWorkitem)) {
    throw new WorkitemStoreError(`Workitem data in ${WORKITEMS_FILE_PATH} has an invalid format.`);
  }

  return { workitems };
}

async function readDocument(): Promise<WorkitemsDocument> {
  try {
    await ensureDataMigrated();
  } catch {
    throw new WorkitemStoreError(`Unable to migrate workitem data; check ${WORKITEMS_FILE_PATH}.`);
  }
  let contents: string;
  try {
    contents = await fs.readFile(WORKITEMS_FILE_PATH, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { workitems: [] };
    }
    throw new WorkitemStoreError(`Unable to read workitem data from ${WORKITEMS_FILE_PATH}.`);
  }

  try {
    return parseDocument(JSON.parse(contents) as unknown);
  } catch (error) {
    if (error instanceof WorkitemStoreError) {
      throw error;
    }
    throw new WorkitemStoreError(`Workitem data in ${WORKITEMS_FILE_PATH} is not valid JSON.`);
  }
}

async function writeDocument(document: WorkitemsDocument): Promise<void> {
  await fs.mkdir(path.dirname(WORKITEMS_FILE_PATH), { recursive: true });
  await fs.writeFile(WORKITEMS_FILE_PATH, `${JSON.stringify(document, null, 2)}\n`, "utf8");
}

function serializeWrite<T>(operation: () => Promise<T>): Promise<T> {
  const result = writeQueue.then(operation, operation);
  writeQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

function workitemDetails(input: unknown): { title: string; detail: string } {
  if (!input || typeof input !== "object") {
    throw new WorkitemValidationError("A workitem title and detail are required.");
  }

  const { title, detail } = input as Record<string, unknown>;
  if (typeof title !== "string" || !title.trim()) {
    throw new WorkitemValidationError("Enter a workitem title.");
  }
  if (typeof detail !== "string") {
    throw new WorkitemValidationError("Enter workitem details.");
  }

  return { title: title.trim(), detail };
}

type WorkitemPatch = Partial<Pick<Workitem, "title" | "detail" | "status">>;

function workitemPatch(input: unknown): WorkitemPatch {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new WorkitemValidationError("Provide at least one workitem field.");
  }

  const values = input as Record<string, unknown>;
  const patch: WorkitemPatch = {};

  if (Object.hasOwn(values, "title")) {
    if (typeof values.title !== "string" || !values.title.trim()) {
      throw new WorkitemValidationError("Enter a workitem title.");
    }
    patch.title = values.title.trim();
  }
  if (Object.hasOwn(values, "detail")) {
    if (typeof values.detail !== "string") {
      throw new WorkitemValidationError("Enter workitem details.");
    }
    patch.detail = values.detail;
  }
  if (Object.hasOwn(values, "status")) {
    if (!isWorkitemStatus(values.status)) {
      throw new WorkitemValidationError("Select a valid workitem status.");
    }
    patch.status = values.status;
  }

  if (Object.keys(patch).length === 0) {
    throw new WorkitemValidationError("Provide at least one workitem field.");
  }

  return patch;
}

function normalizePage(page: number): number {
  return Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1;
}

function normalizePageSize(pageSize: number): number {
  return Number.isFinite(pageSize) && pageSize >= 1 ? Math.floor(pageSize) : WORKITEMS_PAGE_SIZE;
}

function paginateWorkitems(
  workitems: Workitem[],
  { page, pageSize, projectId, statuses }: PaginationInput & { projectId?: string; statuses?: readonly WorkitemStatus[] },
): PaginatedWorkitems {
  const normalizedPage = normalizePage(page);
  const normalizedPageSize = normalizePageSize(pageSize);
  const filteredWorkitems = workitems
    .filter((workitem) => projectId === undefined || workitem.projectId === projectId)
    .filter((workitem) => statuses === undefined || statuses.includes(workitem.status))
    .sort((first, second) => second.createdAt.localeCompare(first.createdAt));
  const total = filteredWorkitems.length;

  return {
    workitems: filteredWorkitems.slice((normalizedPage - 1) * normalizedPageSize, normalizedPage * normalizedPageSize),
    page: normalizedPage,
    pageSize: normalizedPageSize,
    total,
    totalPages: Math.ceil(total / normalizedPageSize),
  };
}

export async function listProjectWorkitems(
  projectId: string,
  { page, pageSize, statuses }: PaginationInput & { statuses?: readonly WorkitemStatus[] },
): Promise<PaginatedWorkitems> {
  const { workitems } = await readDocument();
  return paginateWorkitems(workitems.map(normalizeWorkitem), { page, pageSize, projectId, statuses });
}

export async function listAllWorkitems(
  { page, pageSize, projectId, statuses }: PaginationInput & { projectId?: string; statuses?: readonly WorkitemStatus[] },
): Promise<PaginatedWorkitems> {
  const { workitems } = await readDocument();
  return paginateWorkitems(workitems.map(normalizeWorkitem), { page, pageSize, projectId, statuses });
}

export async function listWorkitemsByStatuses(statuses: readonly WorkitemStatus[]): Promise<Workitem[]> {
  const { workitems } = await readDocument();
  return workitems.map(normalizeWorkitem).filter((workitem) => statuses.includes(workitem.status));
}

export async function getWorkitem(projectId: string, workitemId: number): Promise<Workitem | null> {
  const { workitems } = await readDocument();
  const workitem = workitems.find((candidate) => candidate.projectId === projectId && candidate.id === workitemId);
  return workitem ? normalizeWorkitem(workitem) : null;
}

export async function createWorkitem(projectId: string, input: unknown): Promise<Workitem> {
  const details = workitemDetails(input);

  return serializeWrite(async () => {
    const document = await readDocument();
    const now = new Date().toISOString();
    const nextId = document.workitems
      .reduce((highest, workitem) => Math.max(highest, workitem.id), 0) + 1;
    const workitem: Workitem = {
      id: nextId,
      projectId,
      title: details.title,
      detail: details.detail,
      status: "open",
      completedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    document.workitems.push(workitem);
    await writeDocument(document);
    await appendLifecycleEvent({
      entityType: "workitem",
      entityId: workitem.id,
      projectId: workitem.projectId,
      fromStatus: null,
      toStatus: workitem.status,
      createdAt: now,
    });
    return workitem;
  });
}

export async function updateWorkitem(projectId: string, workitemId: number, input: unknown): Promise<Workitem | null> {
  const patch = workitemPatch(input);

  return serializeWrite(async () => {
    const document = await readDocument();
    const workitem = document.workitems.find((candidate) => candidate.projectId === projectId && candidate.id === workitemId);
    if (!workitem) {
      return null;
    }

    if (patch.title !== undefined) {
      workitem.title = patch.title;
    }
    if (patch.detail !== undefined) {
      workitem.detail = patch.detail;
    }
    const previousStatus = workitem.status ?? DEFAULT_WORKITEM_STATUS;
    const statusChanged = patch.status !== undefined && patch.status !== previousStatus;
    if (patch.status !== undefined) {
      workitem.status = patch.status;
    }
    if (statusChanged) {
      workitem.completedAt = patch.status === "completed" ? new Date().toISOString() : null;
    }
    const now = new Date().toISOString();
    workitem.updatedAt = now;
    await writeDocument(document);
    const updatedWorkitem = normalizeWorkitem(workitem);
    publishWorkitemChange({
      projectId: updatedWorkitem.projectId,
      workitemId: updatedWorkitem.id,
      status: updatedWorkitem.status,
    });
    if (statusChanged) {
      await appendLifecycleEvent({
        entityType: "workitem",
        entityId: updatedWorkitem.id,
        projectId: updatedWorkitem.projectId,
        fromStatus: previousStatus,
        toStatus: updatedWorkitem.status,
        createdAt: now,
      });
    }
    return updatedWorkitem;
  });
}

export async function deleteWorkitem(projectId: string, workitemId: number): Promise<Workitem | null> {
  return serializeWrite(async () => {
    const document = await readDocument();
    const index = document.workitems.findIndex((workitem) => workitem.projectId === projectId && workitem.id === workitemId);
    if (index === -1) {
      return null;
    }

    const [deletedWorkitem] = document.workitems.splice(index, 1);
    await writeDocument(document);
    return normalizeWorkitem(deletedWorkitem);
  });
}

export async function countProjectWorkitems(projectId: string): Promise<number> {
  const { workitems } = await readDocument();
  return workitems.filter((workitem) => workitem.projectId === projectId).length;
}

export async function deleteProjectWorkitems(projectId: string): Promise<number> {
  return serializeWrite(async () => {
    const document = await readDocument();
    const remainingWorkitems = document.workitems.filter((workitem) => workitem.projectId !== projectId);
    const deletedCount = document.workitems.length - remainingWorkitems.length;
    if (deletedCount === 0) {
      return 0;
    }

    document.workitems = remainingWorkitems;
    await writeDocument(document);
    return deletedCount;
  });
}
