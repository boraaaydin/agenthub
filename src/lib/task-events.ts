import type { TaskStatus } from "./task-filters";

export type TaskChange = {
  projectId: string;
  taskId: number;
  status: TaskStatus;
};

type TaskChangeListener = (change: TaskChange) => void;

type TaskEvents = {
  listeners: Set<TaskChangeListener>;
};

type TaskEventsGlobal = typeof globalThis & {
  [key: symbol]: TaskEvents | undefined;
};

const taskEventsKey = Symbol.for("agenthub.taskEvents");
const taskEvents = (globalThis as TaskEventsGlobal)[taskEventsKey] ??= {
  listeners: new Set<TaskChangeListener>(),
};

export function publishTaskChange(change: TaskChange) {
  for (const listener of taskEvents.listeners) {
    try {
      listener(change);
    } catch {
      // A notification listener must not interrupt a persisted task update.
    }
  }
}

export function subscribeToTaskChanges(listener: TaskChangeListener): () => void {
  taskEvents.listeners.add(listener);
  return () => taskEvents.listeners.delete(listener);
}
