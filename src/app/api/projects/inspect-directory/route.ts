import { promises as fs } from "node:fs";
import path from "node:path";

import { GitError, inspectGitDirectory } from "@/lib/git";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const candidatePath = input && typeof input === "object" && "path" in input
    ? (input as Record<string, unknown>).path
    : undefined;
  if (typeof candidatePath !== "string" || !candidatePath.trim()) {
    return Response.json({ error: "Enter a directory path to inspect." }, { status: 400 });
  }
  if (!path.isAbsolute(candidatePath.trim())) {
    return Response.json({ error: "The directory path must be absolute." }, { status: 400 });
  }

  const directory = path.resolve(candidatePath.trim());
  try {
    const stats = await fs.stat(directory);
    if (!stats.isDirectory()) {
      return Response.json({
        exists: true,
        isDirectory: false,
        gitAvailable: false,
        isRepository: false,
        repositoryRoot: null,
        submodules: [],
      });
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return Response.json({
        exists: false,
        isDirectory: false,
        gitAvailable: false,
        isRepository: false,
        repositoryRoot: null,
        submodules: [],
      });
    }
    return Response.json({ error: "The directory could not be accessed." }, { status: 400 });
  }

  try {
    const git = await inspectGitDirectory(directory);
    return Response.json({
      exists: true,
      isDirectory: true,
      gitAvailable: git.available,
      isRepository: git.isRepository,
      repositoryRoot: git.repositoryRoot,
      submodules: git.submodules,
    });
  } catch (error) {
    const message = error instanceof GitError
      ? error.message
      : "The directory could not be inspected.";
    return Response.json({ error: message }, { status: 400 });
  }
}
