import { promises as fs } from "node:fs";
import path from "node:path";

import {
  DEFAULT_AGENT_ID,
  isAgentId,
  type AgentId,
} from "./agents";
import type { SettingsPromptField } from "./settings-prompts";

export type Settings = {
  taskAgent: AgentId;
  planAgent: AgentId;
} & Record<SettingsPromptField, string>;

type SettingsUpdate = Partial<Settings>;

export const SETTINGS_FILE_PATH = path.join(process.cwd(), "data", "settings.json");

let writeQueue: Promise<void> = Promise.resolve();

export class SettingsValidationError extends Error {}

export class SettingsStoreError extends Error {}

const PROMPT_FIELDS: SettingsPromptField[] = [
  "planPrompt",
  "planPostPrompt",
  "taskPrompt",
  "taskPostPrompt",
];

export function defaultSettings(): Settings {
  return {
    taskAgent: DEFAULT_AGENT_ID,
    planAgent: DEFAULT_AGENT_ID,
    planPrompt: "",
    planPostPrompt: "",
    taskPrompt: "",
    taskPostPrompt: "",
  };
}

function parseDocument(value: unknown): Settings {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new SettingsStoreError(`Settings data in ${SETTINGS_FILE_PATH} has an invalid format.`);
  }

  const document = value as Record<string, unknown>;
  const { taskAgent, planAgent } = document;
  if (typeof taskAgent !== "string" || typeof planAgent !== "string") {
    throw new SettingsStoreError(`Settings data in ${SETTINGS_FILE_PATH} has an invalid format.`);
  }
  if (!isAgentId(taskAgent) || !isAgentId(planAgent)) {
    throw new SettingsStoreError(`Settings data in ${SETTINGS_FILE_PATH} references an unknown agent.`);
  }

  const settings = { ...defaultSettings(), taskAgent, planAgent };
  for (const field of PROMPT_FIELDS) {
    if (field in document) {
      if (typeof document[field] !== "string") {
        throw new SettingsStoreError(`Settings data in ${SETTINGS_FILE_PATH} has an invalid format.`);
      }
      settings[field] = document[field];
    }
  }

  return settings;
}

function settingsDetails(input: unknown): SettingsUpdate {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new SettingsValidationError("Settings update must be an object.");
  }

  const update: SettingsUpdate = {};
  const document = input as Record<string, unknown>;

  if ("taskAgent" in document) {
    if (!isAgentId(document.taskAgent)) {
      throw new SettingsValidationError("Select a valid Task agent.");
    }
    update.taskAgent = document.taskAgent;
  }
  if ("planAgent" in document) {
    if (!isAgentId(document.planAgent)) {
      throw new SettingsValidationError("Select a valid Plan agent.");
    }
    update.planAgent = document.planAgent;
  }

  for (const field of PROMPT_FIELDS) {
    if (field in document) {
      const value = document[field];
      if (typeof value !== "string") {
        throw new SettingsValidationError("Prompts must be text.");
      }
      if (value.length > 20_000) {
        throw new SettingsValidationError("Prompts must be 20,000 characters or fewer.");
      }
      update[field] = value;
    }
  }

  return update;
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
  const update = settingsDetails(input);

  return serializeWrite(async () => {
    const settings = { ...await readDocument(), ...update };
    await writeDocument(settings);
    return settings;
  });
}
