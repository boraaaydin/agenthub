import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";

export type Plan = {
  id: number;
  projectId: string;
  taskId: number;
  title: string;
  filePath: string;
  summary: string;
  createdAt: string;
};

type PlansDocument = {
  plans: Plan[];
};

type PaginationInput = {
  page: number;
  pageSize: number;
  projectId?: string;
};

export type PaginatedPlans = {
  plans: Plan[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export const PLANS_FILE_PATH = path.join(process.cwd(), "data", "plans.json");
export const PLANS_PAGE_SIZE = 10;

let writeQueue: Promise<void> = Promise.resolve();

export class PlanValidationError extends Error {}

export class PlanStoreError extends Error {}

function isPlan(value: unknown): value is Plan {
  if (!value || typeof value !== "object") {
    return false;
  }

  const plan = value as Record<string, unknown>;
  return (
    typeof plan.id === "number" &&
    Number.isInteger(plan.id) &&
    plan.id > 0 &&
    typeof plan.projectId === "string" &&
    Boolean(plan.projectId.trim()) &&
    typeof plan.taskId === "number" &&
    Number.isInteger(plan.taskId) &&
    plan.taskId > 0 &&
    typeof plan.title === "string" &&
    Boolean(plan.title.trim()) &&
    typeof plan.filePath === "string" &&
    Boolean(plan.filePath.trim()) &&
    typeof plan.summary === "string" &&
    typeof plan.createdAt === "string"
  );
}

function parseDocument(value: unknown): PlansDocument {
  if (!value || typeof value !== "object" || !("plans" in value)) {
    throw new PlanStoreError(`Plan data in ${PLANS_FILE_PATH} has an invalid format.`);
  }

  const { plans } = value as { plans: unknown };
  if (!Array.isArray(plans) || !plans.every(isPlan)) {
    throw new PlanStoreError(`Plan data in ${PLANS_FILE_PATH} has an invalid format.`);
  }

  return { plans };
}

async function readDocument(): Promise<PlansDocument> {
  let contents: string;
  try {
    contents = await fs.readFile(PLANS_FILE_PATH, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { plans: [] };
    }
    throw new PlanStoreError(`Unable to read plan data from ${PLANS_FILE_PATH}.`);
  }

  try {
    return parseDocument(JSON.parse(contents) as unknown);
  } catch (error) {
    if (error instanceof PlanStoreError) {
      throw error;
    }
    throw new PlanStoreError(`Plan data in ${PLANS_FILE_PATH} is not valid JSON.`);
  }
}

async function writeDocument(document: PlansDocument): Promise<void> {
  await fs.mkdir(path.dirname(PLANS_FILE_PATH), { recursive: true });
  await fs.writeFile(PLANS_FILE_PATH, `${JSON.stringify(document, null, 2)}\n`, "utf8");
}

function serializeWrite<T>(operation: () => Promise<T>): Promise<T> {
  const result = writeQueue.then(operation, operation);
  writeQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

function planDetails(input: unknown): Omit<Plan, "id" | "createdAt"> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new PlanValidationError("Plan details are required.");
  }

  const { projectId, taskId, title, filePath, summary } = input as Record<string, unknown>;
  if (typeof projectId !== "string" || !projectId.trim()) {
    throw new PlanValidationError("Enter a project ID.");
  }

  const normalizedTaskId = typeof taskId === "number"
    ? taskId
    : typeof taskId === "string" && /^\d+$/.test(taskId) && String(Number(taskId)) === taskId
      ? Number(taskId)
      : Number.NaN;
  if (!Number.isInteger(normalizedTaskId) || normalizedTaskId <= 0) {
    throw new PlanValidationError("Enter a positive task ID.");
  }
  if (typeof title !== "string" || !title.trim()) {
    throw new PlanValidationError("Enter a plan title.");
  }
  if (typeof filePath !== "string" || !filePath.trim()) {
    throw new PlanValidationError("Enter a plan file path.");
  }
  if (summary !== undefined && typeof summary !== "string") {
    throw new PlanValidationError("Plan summary must be a string.");
  }

  return {
    projectId: projectId.trim(),
    taskId: normalizedTaskId,
    title: title.trim(),
    filePath: filePath.trim(),
    summary: summary ?? "",
  };
}

function normalizePage(page: number): number {
  return Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1;
}

function normalizePageSize(pageSize: number): number {
  return Number.isFinite(pageSize) && pageSize >= 1 ? Math.floor(pageSize) : PLANS_PAGE_SIZE;
}

export async function createPlan(input: unknown): Promise<Plan> {
  const details = planDetails(input);

  return serializeWrite(async () => {
    const document = await readDocument();
    const plan: Plan = {
      id: document.plans.reduce((highest, candidate) => Math.max(highest, candidate.id), 0) + 1,
      ...details,
      createdAt: new Date().toISOString(),
    };
    document.plans.push(plan);
    await writeDocument(document);
    return plan;
  });
}

export async function listAllPlans({ page, pageSize, projectId }: PaginationInput): Promise<PaginatedPlans> {
  const { plans } = await readDocument();
  const normalizedPage = normalizePage(page);
  const normalizedPageSize = normalizePageSize(pageSize);
  const filteredPlans = plans
    .filter((plan) => projectId === undefined || plan.projectId === projectId)
    .sort((first, second) => second.createdAt.localeCompare(first.createdAt));
  const total = filteredPlans.length;

  return {
    plans: filteredPlans.slice((normalizedPage - 1) * normalizedPageSize, normalizedPage * normalizedPageSize),
    page: normalizedPage,
    pageSize: normalizedPageSize,
    total,
    totalPages: Math.ceil(total / normalizedPageSize),
  };
}
