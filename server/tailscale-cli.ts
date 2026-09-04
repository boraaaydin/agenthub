import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";

const execFile = promisify(execFileCallback);
const COMMAND_TIMEOUT_MS = 5_000;
const TAILSCALE_CANDIDATES = [
  ...(process.env.TAILSCALE_CLI ? [process.env.TAILSCALE_CLI] : []),
  ...platformCandidates(),
];

function platformCandidates(): string[] {
  if (process.platform === "win32") {
    return [
      "tailscale.exe",
      ...windowsInstallLocations(),
    ];
  }

  return [
    "tailscale",
    "/opt/homebrew/bin/tailscale",
    "/usr/local/bin/tailscale",
    ...(process.platform === "darwin"
      ? ["/Applications/Tailscale.app/Contents/MacOS/Tailscale"]
      : []),
  ];
}

function windowsInstallLocations(): string[] {
  return [
    process.env.ProgramFiles,
    process.env["ProgramFiles(x86)"],
  ].filter((directory): directory is string => Boolean(directory)).map(
    (directory) => `${directory}\\Tailscale\\tailscale.exe`,
  );
}

let cachedCliPath: string | null = null;

export async function resolveTailscaleCli(): Promise<string | null> {
  if (cachedCliPath && await canRun(cachedCliPath)) {
    return cachedCliPath;
  }

  cachedCliPath = null;
  for (const candidate of TAILSCALE_CANDIDATES) {
    if (await canRun(candidate)) {
      cachedCliPath = candidate;
      return candidate;
    }
  }

  return null;
}

async function canRun(command: string): Promise<boolean> {
  try {
    await execFile(command, ["version"], {
      timeout: COMMAND_TIMEOUT_MS,
      maxBuffer: 1_000_000,
    });
    return true;
  } catch {
    return false;
  }
}
