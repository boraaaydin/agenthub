import { promises as fs } from "node:fs";
import path from "node:path";

import {
  DEFAULT_AGENT_ID,
  isAgentId,
  type AgentId,
} from "./agents";
import {
  isRemoteAccessMethodId,
  REMOTE_ACCESS_METHODS,
  type RemoteAccessMethodId,
} from "./remote-access";
import type { SettingsPromptField } from "./settings-prompts";
import { publishSettingsChange } from "./settings-events";
import { validateIpRange } from "../../server/ip-allowlist";

export type RemoteAccessSettings = {
  methods: { id: RemoteAccessMethodId; enabled: boolean }[];
  additionalAllowedIps: string[];
};

export type Settings = {
  taskAgent: AgentId;
  planAgent: AgentId;
  defaultProjectPath: string;
  initializeGitInNewProjects: boolean;
  remoteAccess: RemoteAccessSettings;
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
    defaultProjectPath: "",
    initializeGitInNewProjects: true,
    remoteAccess: {
      methods: REMOTE_ACCESS_METHODS.map((method) => ({ id: method.id, enabled: false })),
      additionalAllowedIps: [],
    },
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
  if ("defaultProjectPath" in document) {
    if (typeof document.defaultProjectPath !== "string") {
      throw new SettingsStoreError(`Settings data in ${SETTINGS_FILE_PATH} has an invalid format.`);
    }
    const defaultProjectPath = document.defaultProjectPath.trim();
    settings.defaultProjectPath = defaultProjectPath ? path.resolve(defaultProjectPath) : "";
  }
  if ("initializeGitInNewProjects" in document) {
    if (typeof document.initializeGitInNewProjects !== "boolean") {
      throw new SettingsStoreError(`Settings data in ${SETTINGS_FILE_PATH} has an invalid format.`);
    }
    settings.initializeGitInNewProjects = document.initializeGitInNewProjects;
  }
  if ("remoteAccess" in document) {
    settings.remoteAccess = parseRemoteAccess(document.remoteAccess);
  }

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

async function settingsDetails(input: unknown): Promise<SettingsUpdate> {
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

  if ("defaultProjectPath" in document) {
    if (typeof document.defaultProjectPath !== "string") {
      throw new SettingsValidationError("Enter a project directory path as text.");
    }
    const projectPath = document.defaultProjectPath.trim();
    if (!projectPath) {
      update.defaultProjectPath = "";
    } else {
      const resolvedPath = path.resolve(projectPath);
      try {
        if (!(await fs.stat(resolvedPath)).isDirectory()) {
          throw new SettingsValidationError("The default project directory must point to a directory.");
        }
      } catch (error) {
        if (error instanceof SettingsValidationError) {
          throw error;
        }
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
          throw new SettingsValidationError("The default project directory does not exist.");
        }
        throw new SettingsValidationError("The default project directory could not be accessed.");
      }
      update.defaultProjectPath = resolvedPath;
    }
  }
  if ("initializeGitInNewProjects" in document) {
    if (typeof document.initializeGitInNewProjects !== "boolean") {
      throw new SettingsValidationError("Initialize git in new projects must be true or false.");
    }
    update.initializeGitInNewProjects = document.initializeGitInNewProjects;
  }
  if ("remoteAccess" in document) {
    update.remoteAccess = validateRemoteAccess(document.remoteAccess);
  }

  return update;
}

function parseRemoteAccess(value: unknown): RemoteAccessSettings {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new SettingsStoreError(`Settings data in ${SETTINGS_FILE_PATH} has an invalid format.`);
  }

  const remoteAccess = value as Record<string, unknown>;
  const additionalAllowedIps = parseAdditionalAllowedIps(remoteAccess.additionalAllowedIps);
  if (!("methods" in remoteAccess)) {
    return { ...defaultSettings().remoteAccess, additionalAllowedIps };
  }
  if (!Array.isArray(remoteAccess.methods)) {
    throw new SettingsStoreError(`Settings data in ${SETTINGS_FILE_PATH} has an invalid format.`);
  }

  const enabledById = new Map<RemoteAccessMethodId, boolean>();
  for (const method of remoteAccess.methods) {
    if (!method || typeof method !== "object" || Array.isArray(method)) {
      throw new SettingsStoreError(`Settings data in ${SETTINGS_FILE_PATH} has an invalid format.`);
    }
    const entry = method as Record<string, unknown>;
    if (isRemoteAccessMethodId(entry.id) && typeof entry.enabled === "boolean") {
      enabledById.set(entry.id, entry.enabled);
    }
  }

  return {
    methods: REMOTE_ACCESS_METHODS.map((method) => ({
      id: method.id,
      enabled: enabledById.get(method.id) ?? false,
    })),
    additionalAllowedIps,
  };
}

function validateRemoteAccess(value: unknown): RemoteAccessSettings {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new SettingsValidationError("Remote access settings must be an object.");
  }

  const remoteAccess = value as Record<string, unknown>;
  if (!Array.isArray(remoteAccess.methods)) {
    throw new SettingsValidationError("Remote access methods must be an array.");
  }

  const ids = new Set<RemoteAccessMethodId>();
  const methods = remoteAccess.methods.map((method) => {
    if (!method || typeof method !== "object" || Array.isArray(method)) {
      throw new SettingsValidationError("Each remote access method must include an id and enabled flag.");
    }
    const entry = method as Record<string, unknown>;
    if (!isRemoteAccessMethodId(entry.id)) {
      throw new SettingsValidationError("Select a valid remote access method.");
    }
    if (ids.has(entry.id)) {
      throw new SettingsValidationError("Remote access methods cannot be listed more than once.");
    }
    if (typeof entry.enabled !== "boolean") {
      throw new SettingsValidationError("Remote access method enabled values must be true or false.");
    }
    ids.add(entry.id);
    return { id: entry.id, enabled: entry.enabled };
  });

  const additionalAllowedIps = validateAdditionalAllowedIps(remoteAccess.additionalAllowedIps);

  return { methods, additionalAllowedIps };
}

function parseAdditionalAllowedIps(value: unknown): string[] {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    throw new SettingsStoreError(`Settings data in ${SETTINGS_FILE_PATH} has an invalid format.`);
  }

  try {
    return normalizeAdditionalAllowedIps(value);
  } catch {
    throw new SettingsStoreError(`Settings data in ${SETTINGS_FILE_PATH} has an invalid format.`);
  }
}

function validateAdditionalAllowedIps(value: unknown): string[] {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    throw new SettingsValidationError("Additional allowed IP addresses must be an array of strings.");
  }

  return normalizeAdditionalAllowedIps(value);
}

function normalizeAdditionalAllowedIps(entries: string[]): string[] {
  const normalizedEntries = entries
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (normalizedEntries.length > 50) {
    throw new SettingsValidationError("Additional allowed IP addresses cannot contain more than 50 entries.");
  }

  const seenEntries = new Set<string>();
  return normalizedEntries.map((entry) => {
    let normalizedEntry: string;
    try {
      normalizedEntry = validateIpRange(entry);
    } catch {
      throw new SettingsValidationError(`"${entry}" is not a valid IP address or CIDR range.`);
    }

    if (seenEntries.has(normalizedEntry)) {
      throw new SettingsValidationError(`"${entry}" is listed more than once.`);
    }
    seenEntries.add(normalizedEntry);
    return normalizedEntry;
  });
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
  const update = await settingsDetails(input);

  return serializeWrite(async () => {
    const settings = { ...await readDocument(), ...update };
    await writeDocument(settings);
    publishSettingsChange();
    return settings;
  });
}
