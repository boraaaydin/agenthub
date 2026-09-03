import "server-only";

import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

import { ensureDataMigrated } from "./data-migration";
import { isTaskStatus, type TaskStatus } from "./task-filters";
import { isWorkitemStatus, type WorkitemStatus } from "./workitem-filters";

export type LifecycleEvent =
  | { id: string; entityType: "workitem"; entityId: number; projectId: string; fromStatus: WorkitemStatus | null; toStatus: WorkitemStatus; createdAt: string }
  | { id: string; entityType: "task"; entityId: number; projectId: string; fromStatus: TaskStatus | null; toStatus: TaskStatus; createdAt: string };

export type LifecycleEventInput = Omit<LifecycleEvent, "id">;
type LifecycleLogDocument = { version: 2; events: LifecycleEvent[] };
export type PaginatedLifecycleEvents = { events: LifecycleEvent[]; page: number; pageSize: number; total: number; totalPages: number };
export const LIFECYCLE_LOG_FILE_PATH = path.join(process.cwd(), "data", "lifecycle-log.json");
export const LIFECYCLE_LOG_PAGE_SIZE = 25;
let writeQueue: Promise<void> = Promise.resolve();
export class LifecycleLogStoreError extends Error {}

function isDate(value: unknown): value is string { return typeof value === "string" && !Number.isNaN(Date.parse(value)); }
function isLifecycleEvent(value: unknown): value is LifecycleEvent {
  if (!value || typeof value !== "object") return false;
  const event = value as Record<string, unknown>;
  const shared = typeof event.id === "string" && Boolean(event.id) && typeof event.entityId === "number" && Number.isInteger(event.entityId) && event.entityId > 0 && typeof event.projectId === "string" && Boolean(event.projectId.trim()) && isDate(event.createdAt);
  if (!shared) return false;
  if (event.entityType === "workitem") return (event.fromStatus === null || isWorkitemStatus(event.fromStatus)) && isWorkitemStatus(event.toStatus);
  if (event.entityType === "task") return (event.fromStatus === null || isTaskStatus(event.fromStatus)) && isTaskStatus(event.toStatus);
  return false;
}
function parseDocument(value: unknown): LifecycleLogDocument {
  if (!value || typeof value !== "object" || (value as { version?: unknown }).version !== 2 || !Array.isArray((value as { events?: unknown }).events) || !(value as { events: unknown[] }).events.every(isLifecycleEvent)) throw new LifecycleLogStoreError(`Lifecycle log data in ${LIFECYCLE_LOG_FILE_PATH} has an invalid format.`);
  return value as LifecycleLogDocument;
}
async function readDocument(): Promise<LifecycleLogDocument> {
  try { await ensureDataMigrated(); } catch { throw new LifecycleLogStoreError(`Unable to migrate lifecycle log data; check ${LIFECYCLE_LOG_FILE_PATH}.`); }
  let contents: string;
  try { contents = await fs.readFile(LIFECYCLE_LOG_FILE_PATH, "utf8"); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return { version: 2, events: [] }; throw new LifecycleLogStoreError(`Unable to read lifecycle log data from ${LIFECYCLE_LOG_FILE_PATH}.`); }
  try { return parseDocument(JSON.parse(contents) as unknown); }
  catch (error) { if (error instanceof LifecycleLogStoreError) throw error; throw new LifecycleLogStoreError(`Lifecycle log data in ${LIFECYCLE_LOG_FILE_PATH} is not valid JSON.`); }
}
async function writeDocument(document: LifecycleLogDocument): Promise<void> {
  try { await fs.mkdir(path.dirname(LIFECYCLE_LOG_FILE_PATH), { recursive: true }); await fs.writeFile(LIFECYCLE_LOG_FILE_PATH, `${JSON.stringify(document, null, 2)}\n`, "utf8"); }
  catch { throw new LifecycleLogStoreError(`Unable to write lifecycle log data to ${LIFECYCLE_LOG_FILE_PATH}.`); }
}
function serializeWrite<T>(operation: () => Promise<T>): Promise<T> { const result = writeQueue.then(operation, operation); writeQueue = result.then(() => undefined, () => undefined); return result; }
export async function appendLifecycleEvent(input: LifecycleEventInput): Promise<LifecycleEvent> { return serializeWrite(async () => { const document = await readDocument(); const event: LifecycleEvent = { id: randomUUID(), ...input }; document.events.push(event); await writeDocument(document); return event; }); }
function normalizePage(page: number): number { return Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1; }
export async function listLifecycleEvents({ page, pageSize }: { page: number; pageSize: number }): Promise<PaginatedLifecycleEvents> { const document = await readDocument(); const normalizedPage = normalizePage(page); const normalizedPageSize = Number.isFinite(pageSize) && pageSize >= 1 ? Math.floor(pageSize) : LIFECYCLE_LOG_PAGE_SIZE; const events = [...document.events].sort((first, second) => second.createdAt.localeCompare(first.createdAt) || second.id.localeCompare(first.id)); const total = events.length; return { events: events.slice((normalizedPage - 1) * normalizedPageSize, normalizedPage * normalizedPageSize), page: normalizedPage, pageSize: normalizedPageSize, total, totalPages: Math.ceil(total / normalizedPageSize) }; }
export function logsHref(page?: number): string { return page && page > 1 ? `/logs?page=${page}` : "/logs"; }
