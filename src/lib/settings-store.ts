import { promises as fs } from "node:fs";
import path from "node:path";

import {
  DEFAULT_AGENT_ID,
  isAgentId,
  type AgentId,
} from "./agents";

export type Settings = {
  taskAgent: AgentId;
  planAgent: AgentId;
};

export const SETTINGS_FILE_PATH = path.join(process.cwd(), "data", "settings.json");

let writeQueue: Promise<void> = Promise.resolve();

export class SettingsValidationError extends Error {}

export class SettingsStoreError extends Error {}

function defaultSettings(): Settings {
  return {
    taskAgent: DEFAULT_AGENT_ID,
    planAgent: DEFAULT_AGENT_ID,
  };
}

function parseDocument(value: unknown): Settings {
  if (!value || typeof value !== "object") {
    throw new SettingsStoreError(`Settings data in ${SETTINGS_FILE_PATH} has an invalid format.`);
  }

  const { taskAgent, planAgent } = value as Record<string, unknown>;
  if (typeof taskAgent !== "string" || typeof planAgent !== "string") {
    throw new SettingsStoreError(`Settings data in ${SETTINGS_FILE_PATH} has an invalid format.`);
  }
  if (!isAgentId(taskAgent) || !isAgentId(planAgent)) {
    throw new SettingsStoreError(`Settings data in ${SETTINGS_FILE_PATH} references an unknown agent.`);
  }

  return { taskAgent, planAgent };
}

function settingsDetails(input: unknown): Settings {
  if (!input || typeof input !== "object") {
    throw new SettingsValidationError("Task and Plan agents are required.");
  }

  const { taskAgent, planAgent } = input as Record<string, unknown>;
  if (!isAgentId(taskAgent)) {
    throw new SettingsValidationError("Select a valid Task agent.");
  }
  if (!isAgentId(planAgent)) {
    throw new SettingsValidationError("Select a valid Plan agent.");
  }

  return { taskAgent, planAgent };
}

async function readDocument(): Promise<Settings> {
  let contents: string;
  try {
    contents = await fs.readFile(SETTINGS_FILE_PATH, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return defaultSettings();
    }
    throw new SettingsStoreError(`Unable to read settings data from ${SETTINGS_FILE_PATH}.`);
  }

  try {
    return parseDocument(JSON.parse(contents) as unknown);
  } catch (error) {
    if (error instanceof SettingsStoreError) {
      throw error;
    }
    throw new SettingsStoreError(`Settings data in ${SETTINGS_FILE_PATH} is not valid JSON.`);
  }
}

async function writeDocument(settings: Settings): Promise<void> {
  await fs.mkdir(path.dirname(SETTINGS_FILE_PATH), { recursive: true });
  await fs.writeFile(
    SETTINGS_FILE_PATH,
    `${JSON.stringify(settings, null, 2)}\n`,
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

export async function readSettings(): Promise<Settings> {
  return readDocument();
}

export async function saveSettings(input: unknown): Promise<Settings> {
  const settings = settingsDetails(input);

  return serializeWrite(async () => {
    await writeDocument(settings);
    return settings;
  });
}
