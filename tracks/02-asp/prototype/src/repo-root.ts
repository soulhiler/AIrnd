import { resolve, isAbsolute, normalize, sep } from "node:path";

/**
 * Repository root configuration. Set once at server startup, used for path
 * traversal checks (spec Section 9.1).
 */

let configuredRoot: string | null = null;

export function setRepoRoot(root: string): void {
  configuredRoot = resolve(root);
}

export function getRepoRoot(): string {
  if (configuredRoot === null) {
    throw new Error("Repo root not configured; call setRepoRoot first");
  }
  return configuredRoot;
}

/**
 * Resolve a user-supplied path relative to repo root, rejecting anything that
 * escapes the root via `..`, absolute paths, or symlink trickery (basic check).
 *
 * Returns absolute path, or throws Error.
 */
export function resolveSafe(userPath: string): string {
  if (typeof userPath !== "string" || userPath.length === 0) {
    throw new PathForbiddenError("Empty path");
  }
  if (isAbsolute(userPath)) {
    throw new PathForbiddenError("Absolute paths not allowed");
  }
  const root = getRepoRoot();
  const resolved = resolve(root, userPath);
  const normalizedResolved = normalize(resolved);
  if (
    normalizedResolved !== root &&
    !normalizedResolved.startsWith(root + sep)
  ) {
    throw new PathForbiddenError(
      `Path escapes repo root: ${userPath}`,
    );
  }
  return normalizedResolved;
}

export class PathForbiddenError extends Error {
  public override readonly name = "PathForbiddenError";
}
