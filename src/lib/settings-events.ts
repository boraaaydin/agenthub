type SettingsChangeListener = () => void;

type SettingsEvents = {
  listeners: Set<SettingsChangeListener>;
};

type SettingsEventsGlobal = typeof globalThis & {
  [key: symbol]: SettingsEvents | undefined;
};

const settingsEventsKey = Symbol.for("agenthub.settingsEvents");
const settingsEvents = (globalThis as SettingsEventsGlobal)[settingsEventsKey] ??= {
  listeners: new Set<SettingsChangeListener>(),
};

export function publishSettingsChange() {
  for (const listener of settingsEvents.listeners) {
    try {
      listener();
    } catch {
      // A notification listener must not interrupt a persisted settings update.
    }
  }
}

export function subscribeToSettingsChanges(listener: SettingsChangeListener): () => void {
  settingsEvents.listeners.add(listener);
  return () => settingsEvents.listeners.delete(listener);
}
