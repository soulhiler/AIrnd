import { existsSync, realpathSync } from "node:fs";
import { basename, dirname, isAbsolute, normalize, relative, resolve, sep } from "node:path";
import { pathHasSensitiveSegment, tryRealpath } from "./security.js";

/**
 * Repository root configuration. Set once at server startup, used for path
 * traversal checks (spec Section 9.1).
 *
 * Hardening notes:
 *  - The repo root itself is canonicalised via `realpath` so that a
 *    symlinked working directory is compared against its real target.
 *  - User-supplied paths are first normalised, then `realpath`'d if they
 *    exist, then compared against the real root. This defeats symlink
 *    escape where a path inside the repo points outside.
 *  - Sensitive filenames are rejected BOTH on the user-supplied form AND
 *    on the post-canonicalisation form. The second check closes an
 *    in-repo bypass: `data.json` → `.env` symlink lets the denylist
 *    miss the first check but the canonicalised name `.env` is caught.
 */

let configuredRoot: string | null = null;

export function setRepoRoot(root: string): void {
  const abs = resolve(root);
  configuredRoot = tryRealpath(abs);
}

export function getRepoRoot(): string {
  if (configuredRoot === null) {
    throw new Error("Repo root not configured; call setRepoRoot first");
  }
  return configuredRoot;
}

/**
 * Resolve a user-supplied path relative to repo root, rejecting anything
 * that escapes the root via `..`, absolute paths, symlink trickery, or
 * sensitive-filename matches (checked on both the user form and the
 * canonical form).
 *
 * Returns absolute (and, where possible, canonicalised) path; throws
 * `PathForbiddenError` otherwise.
 */
export function resolveSafe(userPath: string): string {
  if (typeof userPath !== "string" || userPath.length === 0) {
    throw new PathForbiddenError("Empty path");
  }
  if (isAbsolute(userPath)) {
    throw new PathForbiddenError("Absolute paths not allowed");
  }
  const root = getRepoRoot();
  const naive = normalize(resolve(root, userPath));

  // Reject before touching the filesystem if the relative form steps
  // outside the root or matches a sensitive name on its face.
  if (naive !== root && !naive.startsWith(root + sep)) {
    throw new PathForbiddenError(`Path escapes repo root: ${userPath}`);
  }
  if (pathHasSensitiveSegment(userPath)) {
    throw new PathForbiddenError(
      `Sensitive path rejected (matches secret/key denylist): ${userPath}`,
    );
  }

  // Canonicalise via realpath where possible. For a not-yet-existing path
  // (writeFile creating a new file) we walk up to the nearest existing
  // ancestor and canonicalise that, then append the tail.
  const real = canonicaliseWithExistingAncestor(naive);
  if (real !== root && !real.startsWith(root + sep)) {
    throw new PathForbiddenError(
      `Path resolves outside repo root via symlink: ${userPath}`,
    );
  }

  // Post-canonicalisation denylist check — closes the in-repo symlink
  // bypass: a non-sensitive alias inside the repo (e.g. `data.json`)
  // that points at a sensitive target (e.g. `.env`) must still be
  // rejected.
  const realRel = relative(root, real);
  if (realRel.length > 0 && pathHasSensitiveSegment(realRel)) {
    throw new PathForbiddenError(
      `Sensitive target rejected after realpath (denylist match on canonical form: ${realRel})`,
    );
  }
  return real;
}

/**
 * Return realpath of the closest existing ancestor of `abs`, with the
 * non-existing tail appended verbatim. Lets us validate destinations for
 * asp_writeFile / asp_applyPatch (the file may not exist yet) without
 * losing realpath protection on the parent directories.
 */
function canonicaliseWithExistingAncestor(abs: string): string {
  if (existsSync(abs)) {
    return realpathSync(abs);
  }
  let parent = dirname(abs);
  const tail: string[] = [basename(abs)];
  while (parent !== dirname(parent)) {
    if (existsSync(parent)) {
      const realParent = realpathSync(parent);
      return realParent + sep + tail.reverse().join(sep);
    }
    tail.push(basename(parent));
    parent = dirname(parent);
  }
  return abs;
}

export class PathForbiddenError extends Error {
  public override readonly name = "PathForbiddenError";
}
