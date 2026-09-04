import path from "node:path";

export function isPathWithin(root: string, candidate: string): boolean {
  const resolvedRoot = path.resolve(root);
  const resolvedCandidate = path.resolve(candidate);
  return resolvedCandidate === resolvedRoot
    || resolvedCandidate.startsWith(`${resolvedRoot}${path.sep}`);
}

export function findAllowedRoot(cwd: string, roots: string[]): string | null {
  return roots.find((root) => isPathWithin(root, cwd)) ?? null;
}
