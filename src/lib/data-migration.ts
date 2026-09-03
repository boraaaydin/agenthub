import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";

const dataDirectory = path.join(process.cwd(), "data");
const workitemsPath = path.join(dataDirectory, "workitems.json");
const tasksPath = path.join(dataDirectory, "tasks.json");
const plansPath = path.join(dataDirectory, "plans.json");
const lifecyclePath = path.join(dataDirectory, "lifecycle-log.json");

let migrationPromise: Promise<void> | undefined;

export class DataMigrationError extends Error {}

async function readJson(filePath: string): Promise<unknown | null> {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8")) as unknown;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw new DataMigrationError(`Unable to migrate data; check ${filePath}.`);
  }
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  try {
    await fs.mkdir(dataDirectory, { recursive: true });
    await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  } catch {
    throw new DataMigrationError(`Unable to migrate data; check ${filePath}.`);
  }
}

function oldWorkitems(value: unknown): Record<string, unknown>[] | null {
  if (!value || typeof value !== "object" || !Array.isArray((value as { tasks?: unknown }).tasks)) return null;
  const entries = (value as { tasks: unknown[] }).tasks;
  return entries.every((entry) => entry && typeof entry === "object" && !("filePath" in entry))
    ? entries as Record<string, unknown>[]
    : null;
}

async function migrateWorkitems() {
  try {
    await fs.access(workitemsPath);
    return;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw new DataMigrationError(`Unable to migrate data; check ${workitemsPath}.`);
  }
  const source = await readJson(tasksPath);
  const entries = oldWorkitems(source);
  if (!entries) return;
  await writeJson(workitemsPath, { workitems: entries.map((entry) => ({
    ...entry,
    status: entry.status === "plan_creating" ? "task_creating" : entry.status === "plan_created" ? "task_created" : entry.status,
  })) });
  await fs.unlink(tasksPath);
}

async function migrateTasks() {
  try {
    await fs.access(tasksPath);
    return;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw new DataMigrationError(`Unable to migrate data; check ${tasksPath}.`);
  }
  const source = await readJson(plansPath);
  if (!source || typeof source !== "object" || !Array.isArray((source as { plans?: unknown }).plans)) return;
  const plans = (source as { plans: Record<string, unknown>[] }).plans;
  await writeJson(tasksPath, { tasks: plans.map(({ taskId, status, ...task }) => ({
    ...task,
    workitemId: taskId,
    status: status === "registered" ? "created" : status === "closed" ? "completed" : status,
  })) });
  await fs.unlink(plansPath);
}

async function migrateLifecycleLog() {
  const source = await readJson(lifecyclePath);
  if (!source || typeof source !== "object" || "version" in source) return;
  const events = Array.isArray((source as { events?: unknown }).events) ? (source as { events: Record<string, unknown>[] }).events : null;
  if (!events) throw new DataMigrationError(`Unable to migrate data; check ${lifecyclePath}.`);
  await writeJson(lifecyclePath, { version: 2, events: events.map((event) => {
    const oldWorkitem = event.entityType === "task";
    const mapStatus = (status: unknown) => status === "plan_creating" ? "task_creating" : status === "plan_created" ? "task_created" : status === "registered" ? "created" : status;
    return {
      ...event,
      entityType: oldWorkitem ? "workitem" : event.entityType === "plan" ? "task" : event.entityType,
      fromStatus: mapStatus(event.fromStatus),
      toStatus: mapStatus(event.toStatus),
    };
  }) });
}

export function ensureDataMigrated(): Promise<void> {
  migrationPromise ??= (async () => {
    await migrateWorkitems();
    await migrateTasks();
    await migrateLifecycleLog();
  })();
  return migrationPromise;
}
