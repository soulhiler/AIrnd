import { readFile, writeFile } from "node:fs/promises";
import { z } from "zod";
import { resolveSafe } from "../repo-root.js";
import { mutationsEnabled } from "../security.js";
import { MutationsDisabledError } from "./write-file.js";
import type { DegradationEntry } from "../types.js";

/**
 * `asp/applyPatch` — spec Section 6.4.2.
 *
 * Stage 2c: simple unified-diff applier. Supports the standard `@@ -a,b +c,d @@`
 * hunk header format and ` ` / `-` / `+` line prefixes. Does NOT support binary
 * patches, file renames, mode changes, or fuzzy matching — degraded in those
 * cases with a clear error.
 *
 * On dryRun=true we validate the patch (parse + verify all hunks apply) without
 * touching the filesystem.
 */

const ApplyPatchParamsSchema = z.object({
  patch: z.string().min(1),
  dryRun: z.boolean().optional(),
});

export type ApplyPatchParams = z.infer<typeof ApplyPatchParamsSchema>;

export interface PatchConflict {
  path: string;
  hunkIndex: number;
  reason: string;
}

export interface ApplyPatchResult {
  applied: boolean;
  filesAffected: string[];
  linesAdded: number;
  linesRemoved: number;
  conflicts: PatchConflict[];
  degradation: DegradationEntry[];
}

export class PatchMalformedError extends Error {
  public override readonly name = "PatchMalformedError";
}

export class PatchConflictError extends Error {
  public override readonly name = "PatchConflictError";
  constructor(
    message: string,
    public readonly conflicts: PatchConflict[],
  ) {
    super(message);
  }
}

interface Hunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: Array<{ op: " " | "+" | "-"; text: string }>;
}

interface FilePatch {
  oldPath: string;
  newPath: string;
  hunks: Hunk[];
}

export async function applyPatchOp(
  rawParams: unknown,
): Promise<ApplyPatchResult> {
  const params = ApplyPatchParamsSchema.parse(rawParams);
  const dryRun = params.dryRun ?? false;
  // Even dryRun is gated: parsing & validating a patch on behalf of an
  // untrusted client is fine, but we want a single uniform policy so
  // there's no "is it on or off?" ambiguity for users.
  if (!mutationsEnabled() && !dryRun) {
    throw new MutationsDisabledError(
      "asp_applyPatch is disabled. Set ASP_ENABLE_MUTATIONS=1 to opt in. Use dryRun=true to validate without writing.",
    );
  }
  const degradation: DegradationEntry[] = [];

  if (params.patch.includes("Binary files")) {
    degradation.push({
      feature: "binary-patch",
      reason: "Binary patches are not supported",
      impact: "Hunks marked `Binary files differ` are skipped",
      severity: "warning",
    });
  }

  const filePatches = parseUnifiedDiff(params.patch);
  if (filePatches.length === 0) {
    throw new PatchMalformedError(
      "No file patches found in input (expected `--- ... / +++ ...` headers)",
    );
  }

  const conflicts: PatchConflict[] = [];
  const filesAffected: string[] = [];
  let linesAdded = 0;
  let linesRemoved = 0;

  for (const fp of filePatches) {
    // Resolve target path (use newPath unless it's /dev/null).
    const target = fp.newPath === "/dev/null" ? fp.oldPath : fp.newPath;
    if (target === "/dev/null") {
      degradation.push({
        feature: "patch-delete",
        reason: "Deleting files via patch is not implemented in Stage 2c",
        impact: `File ${fp.oldPath} would have been deleted; left unchanged`,
        severity: "warning",
      });
      continue;
    }

    const absPath = resolveSafe(stripDiffPrefix(target));
    let original = "";
    try {
      original = await readFile(absPath, "utf-8");
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
      // New file: the patch should be entirely additions.
      if (fp.oldPath !== "/dev/null") {
        conflicts.push({
          path: target,
          hunkIndex: -1,
          reason: "File does not exist on disk but patch did not mark it new",
        });
        continue;
      }
    }

    const result = applyHunksToText(original, fp.hunks);
    if (result.conflicts.length > 0) {
      for (const c of result.conflicts) {
        conflicts.push({ path: target, hunkIndex: c.hunkIndex, reason: c.reason });
      }
      continue;
    }

    linesAdded += result.linesAdded;
    linesRemoved += result.linesRemoved;
    filesAffected.push(stripDiffPrefix(target));

    if (!dryRun) {
      await writeFile(absPath, result.text, "utf-8");
    }
  }

  return {
    applied: !dryRun && conflicts.length === 0,
    filesAffected,
    linesAdded,
    linesRemoved,
    conflicts,
    degradation,
  };
}

function stripDiffPrefix(p: string): string {
  // Standard `a/` and `b/` prefixes from git-style diffs.
  if (p.startsWith("a/") || p.startsWith("b/")) return p.slice(2);
  return p;
}

const HUNK_RE = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;

function parseUnifiedDiff(patch: string): FilePatch[] {
  const lines = patch.split("\n");
  const out: FilePatch[] = [];
  let current: FilePatch | null = null;
  let currentHunk: Hunk | null = null;
  // How many `oldLines + addedLines` we expect in the current hunk; once we've
  // consumed that many body lines we stop and look for the next hunk header.
  let remainingOld = 0;
  let remainingNew = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (line.startsWith("--- ")) {
      const oldPath = line.slice(4).trim().split(/\s+/)[0] ?? "";
      const next = lines[i + 1] ?? "";
      if (!next.startsWith("+++ ")) {
        throw new PatchMalformedError("`--- ` line not followed by `+++ `");
      }
      const newPath = next.slice(4).trim().split(/\s+/)[0] ?? "";
      i++;
      currentHunk = null;
      current = { oldPath, newPath, hunks: [] };
      out.push(current);
      continue;
    }
    const hunkMatch = HUNK_RE.exec(line);
    if (hunkMatch !== null) {
      if (current === null) {
        throw new PatchMalformedError("Hunk header before file header");
      }
      const oldLines = hunkMatch[2] !== undefined ? Number(hunkMatch[2]) : 1;
      const newLines = hunkMatch[4] !== undefined ? Number(hunkMatch[4]) : 1;
      currentHunk = {
        oldStart: Number(hunkMatch[1]),
        oldLines,
        newStart: Number(hunkMatch[3]),
        newLines,
        lines: [],
      };
      remainingOld = oldLines;
      remainingNew = newLines;
      current.hunks.push(currentHunk);
      continue;
    }
    if (currentHunk === null) continue;
    if (remainingOld <= 0 && remainingNew <= 0) {
      // Hunk body done; further lines are between-hunk noise (or trailing
      // newline producing an empty string). Stop consuming this hunk.
      currentHunk = null;
      // Re-process this line as it may be another hunk header or file header.
      i--;
      continue;
    }
    const prefix = line[0];
    if (prefix === " ") {
      currentHunk.lines.push({ op: " ", text: line.slice(1) });
      remainingOld--;
      remainingNew--;
    } else if (prefix === "+") {
      currentHunk.lines.push({ op: "+", text: line.slice(1) });
      remainingNew--;
    } else if (prefix === "-") {
      currentHunk.lines.push({ op: "-", text: line.slice(1) });
      remainingOld--;
    } else if (line === "\\ No newline at end of file") {
      // ignore
    } else {
      // Unknown line within hunk body → end of hunk.
      currentHunk = null;
    }
  }
  return out;
}

function applyHunksToText(
  source: string,
  hunks: Hunk[],
): {
  text: string;
  linesAdded: number;
  linesRemoved: number;
  conflicts: Array<{ hunkIndex: number; reason: string }>;
} {
  const original = source.split("\n");
  // We rebuild the file by replaying hunks; offsets shift as we add/remove.
  let cursor = 0;
  const out: string[] = [];
  let linesAdded = 0;
  let linesRemoved = 0;
  const conflicts: Array<{ hunkIndex: number; reason: string }> = [];

  hunks.forEach((hunk, hunkIdx) => {
    const start = hunk.oldStart - 1; // 0-indexed
    if (start < cursor) {
      conflicts.push({
        hunkIndex: hunkIdx,
        reason: `Hunk start ${hunk.oldStart} precedes previous applied hunk`,
      });
      return;
    }
    // Copy unchanged lines from cursor up to start.
    for (let j = cursor; j < start; j++) {
      out.push(original[j] ?? "");
    }
    cursor = start;

    // Apply hunk body.
    for (const hl of hunk.lines) {
      if (hl.op === " ") {
        const orig = original[cursor];
        if (orig === undefined || orig !== hl.text) {
          conflicts.push({
            hunkIndex: hunkIdx,
            reason: `Context mismatch at line ${cursor + 1}: expected ${JSON.stringify(
              hl.text,
            )}, got ${JSON.stringify(orig ?? "<EOF>")}`,
          });
          return;
        }
        out.push(hl.text);
        cursor++;
      } else if (hl.op === "-") {
        const orig = original[cursor];
        if (orig === undefined || orig !== hl.text) {
          conflicts.push({
            hunkIndex: hunkIdx,
            reason: `Removal mismatch at line ${cursor + 1}: expected ${JSON.stringify(
              hl.text,
            )}, got ${JSON.stringify(orig ?? "<EOF>")}`,
          });
          return;
        }
        cursor++;
        linesRemoved++;
      } else if (hl.op === "+") {
        out.push(hl.text);
        linesAdded++;
      }
    }
  });

  if (conflicts.length > 0) {
    return { text: source, linesAdded: 0, linesRemoved: 0, conflicts };
  }

  // Copy trailing untouched lines.
  for (let j = cursor; j < original.length; j++) {
    out.push(original[j] ?? "");
  }

  return {
    text: out.join("\n"),
    linesAdded,
    linesRemoved,
    conflicts,
  };
}
