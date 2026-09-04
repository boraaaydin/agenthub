import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";

const execFile = promisify(execFileCallback);
const COMMAND_TIMEOUT_MS = 5_000;
const WINGET_CANDIDATES = [
  ...(process.env.WINGET_CLI ? [process.env.WINGET_CLI] : []),
  "winget",
];

let cachedCliPath: string | null = null;

export async function resolveWingetCli(): Promise<string | null> {
  if (process.platform !== "win32") {
    return null;
  }

  if (cachedCliPath && await canRun(cachedCliPath)) {
    return cachedCliPath;
  }

  cachedCliPath = null;
  for (const candidate of WINGET_CANDIDATES) {
    if (await canRun(candidate)) {
      cachedCliPath = candidate;
      return candidate;
    }
  }

  return null;
}

async function canRun(command: string): Promise<boolean> {
  try {
    await execFile(command, ["--version"], {
      timeout: COMMAND_TIMEOUT_MS,
      maxBuffer: 1_000_000,
    });
    return true;
  } catch {
    return false;
  }
}
