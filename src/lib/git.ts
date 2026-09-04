import "server-only";

import { execFile as execFileCallback } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

import { resolveGitCli } from "../../server/git-cli";

const execFile = promisify(execFileCallback);
const COMMAND_TIMEOUT_MS = 5_000;

export type GitSubmodule = {
  name: string;
  path: string;
};

export type GitDirectoryStatus = {
  available: boolean;
  isRepository: boolean;
  repositoryRoot: string | null;
  submodules: GitSubmodule[];
};

export class GitError extends Error {}

export async function isGitAvailable(): Promise<boolean> {
  return Boolean(await resolveGitCli());
}

export async function inspectGitDirectory(directory: string): Promise<GitDirectoryStatus> {
  const command = await resolveGitCli();
  if (!command) {
    return { available: false, isRepository: false, repositoryRoot: null, submodules: [] };
  }

  try {
    const { stdout } = await execFile(command, ["-C", directory, "rev-parse", "--is-inside-work-tree"], {
      timeout: COMMAND_TIMEOUT_MS,
      maxBuffer: 1_000_000,
    });
    if (stdout.trim() !== "true") {
      return { available: true, isRepository: false, repositoryRoot: null, submodules: [] };
    }
  } catch {
    return { available: true, isRepository: false, repositoryRoot: null, submodules: [] };
  }

  try {
    const { stdout } = await execFile(command, ["-C", directory, "rev-parse", "--show-toplevel"], {
      timeout: COMMAND_TIMEOUT_MS,
      maxBuffer: 1_000_000,
    });
    const repositoryRoot = path.resolve(stdout.trim());
    return {
      available: true,
      isRepository: true,
      repositoryRoot,
      submodules: await readSubmodules(command, repositoryRoot),
    };
  } catch (error) {
    throw new GitError(`Git repository details could not be read: ${errorMessage(error)}`);
  }
}

export async function initializeGitRepository(directory: string): Promise<void> {
  const command = await resolveGitCli();
  if (!command) {
    throw new GitError("Git is not available on this machine.");
  }

  try {
    await execFile(command, ["-C", directory, "init"], {
      timeout: COMMAND_TIMEOUT_MS,
      maxBuffer: 1_000_000,
    });
  } catch (error) {
    throw new GitError(`Git could not be initialized: ${errorMessage(error)}`);
  }
}

async function readSubmodules(command: string, repositoryRoot: string): Promise<GitSubmodule[]> {
  const gitmodulesPath = path.join(repositoryRoot, ".gitmodules");
  try {
    await fs.access(gitmodulesPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw new GitError(`The repository's .gitmodules file could not be accessed: ${errorMessage(error)}`);
  }

  let stdout: string;
  try {
    ({ stdout } = await execFile(command, [
      "-C",
      repositoryRoot,
      "config",
      "--file",
      ".gitmodules",
      "--get-regexp",
      "^submodule\\..*\\.path$",
    ], {
      timeout: COMMAND_TIMEOUT_MS,
      maxBuffer: 1_000_000,
    }));
  } catch (error) {
    throw new GitError(`The repository's .gitmodules file could not be read: ${errorMessage(error)}`);
  }

  const rootPrefix = `${repositoryRoot}${path.sep}`;
  const submodules: GitSubmodule[] = [];
  for (const line of stdout.split("\n")) {
    const match = /^submodule\.(.+)\.path\s+(.+)$/.exec(line.trim());
    if (!match) {
      continue;
    }

    const submodulePath = path.resolve(repositoryRoot, match[2]);
    if (!submodulePath.startsWith(rootPrefix)) {
      continue;
    }

    try {
      if ((await fs.stat(submodulePath)).isDirectory()) {
        submodules.push({ name: match[1], path: submodulePath });
      }
    } catch {
      // An uninitialized or inaccessible submodule is not an available application.
    }
  }

  return submodules;
}

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : "an unknown error occurred.";
}
