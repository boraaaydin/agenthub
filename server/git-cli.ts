import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";

const execFile = promisify(execFileCallback);
const COMMAND_TIMEOUT_MS = 5_000;
const GIT_CANDIDATES = [
  ...(process.env.GIT_CLI ? [process.env.GIT_CLI] : []),
  "git",
  "/opt/homebrew/bin/git",
  "/usr/local/bin/git",
  "/usr/bin/git",
];

let cachedCliPath: string | null = null;

export async function resolveGitCli(): Promise<string | null> {
  if (cachedCliPath && await canRun(cachedCliPath)) {
    return cachedCliPath;
  }

  cachedCliPath = null;
  for (const candidate of GIT_CANDIDATES) {
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
