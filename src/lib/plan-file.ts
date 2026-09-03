import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";

const PLAN_FILE_PREVIEW_MAX_BYTES = 512 * 1024;

type ReadPlanFileResult =
  | { status: "ok"; content: string }
  | { status: "not-found" }
  | { status: "too-large" }
  | { status: "invalid-path" }
  | { status: "error"; message: string };

type DeletePlanFileResult = {
  status: "deleted" | "not-found" | "invalid-path" | "error";
  message?: string;
};

function isNotFoundError(error: unknown): boolean {
  const code = (error as NodeJS.ErrnoException).code;
  return code === "ENOENT" || code === "EISDIR";
}

export function resolvePlanFilePath(projectPath: string, filePath: string): string | null {
  if (path.isAbsolute(filePath)) {
    return null;
  }

  const resolvedProjectPath = path.resolve(projectPath);
  const resolvedFilePath = path.resolve(resolvedProjectPath, filePath);
  return resolvedFilePath.startsWith(`${resolvedProjectPath}${path.sep}`) ? resolvedFilePath : null;
}

export async function readPlanFile(projectPath: string, filePath: string): Promise<ReadPlanFileResult> {
  const resolvedFilePath = resolvePlanFilePath(projectPath, filePath);
  if (!resolvedFilePath) {
    return { status: "invalid-path" };
  }

  try {
    const stats = await fs.stat(resolvedFilePath);
    if (!stats.isFile()) {
      return { status: "not-found" };
    }
    if (stats.size > PLAN_FILE_PREVIEW_MAX_BYTES) {
      return { status: "too-large" };
    }
    return { status: "ok", content: await fs.readFile(resolvedFilePath, "utf8") };
  } catch (error) {
    if (isNotFoundError(error)) {
      return { status: "not-found" };
    }
    console.error("Unable to read plan file", error);
    return { status: "error", message: "The plan file could not be read." };
  }
}

export async function deletePlanFile(projectPath: string, filePath: string): Promise<DeletePlanFileResult> {
  const resolvedFilePath = resolvePlanFilePath(projectPath, filePath);
  if (!resolvedFilePath) {
    return { status: "invalid-path" };
  }

  try {
    const stats = await fs.lstat(resolvedFilePath);
    if (stats.isDirectory()) {
      return { status: "not-found" };
    }
    await fs.unlink(resolvedFilePath);
    return { status: "deleted" };
  } catch (error) {
    if (isNotFoundError(error)) {
      return { status: "not-found" };
    }
    console.error("Unable to delete plan file", error);
    return { status: "error", message: "The plan file could not be deleted." };
  }
}
