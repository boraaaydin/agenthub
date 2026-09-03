import type { WorkitemStatus } from "./workitem-filters";

export type WorkitemChange = {
  projectId: string;
  workitemId: number;
  status: WorkitemStatus;
};

type WorkitemChangeListener = (change: WorkitemChange) => void;

type WorkitemEvents = {
  listeners: Set<WorkitemChangeListener>;
};

type WorkitemEventsGlobal = typeof globalThis & {
  [key: symbol]: WorkitemEvents | undefined;
};

const workitemEventsKey = Symbol.for("agenthub.workitemEvents");
const workitemEvents = (globalThis as WorkitemEventsGlobal)[workitemEventsKey] ??= {
  listeners: new Set<WorkitemChangeListener>(),
};

export function publishWorkitemChange(change: WorkitemChange) {
  for (const listener of workitemEvents.listeners) {
    try {
      listener(change);
    } catch {
      // A notification listener must not interrupt a persisted workitem update.
    }
  }
}

export function subscribeToWorkitemChanges(listener: WorkitemChangeListener): () => void {
  workitemEvents.listeners.add(listener);
  return () => workitemEvents.listeners.delete(listener);
}
