import { readFile, stat } from "node:fs/promises";
import { z } from "zod";
import { resolveSafe, PathForbiddenError } from "../repo-root.js";
import { pathHasSensitiveSegment } from "../security.js";
import { estimateTokens } from "../token-estimate.js";
import type { DegradationEntry } from "../types.js";

/**
 * `asp/readFile` — spec Section 6.2.1.
 * Safety: read-only. Token-budget aware.
 */

const ReadFileParamsSchema = z.object({
  path: z.string().min(1),
  lineRange: z
    .object({
      start: z.number().int().min(1),
      end: z.number().int().min(1),
    })
    .optional(),
  tokenBudget: z.number().int().positive().optional(),
});

export type ReadFileParams = z.infer<typeof ReadFileParamsSchema>;

export interface ReadFileResult {
  content: string;
  truncated: boolean;
  totalLines: number;
  encoding: "utf-8";
  degradation: DegradationEntry[];
}

export async function readFileOp(rawParams: unknown): Promise<ReadFileResult> {
  const params = ReadFileParamsSchema.parse(rawParams);
  // Secret denylist check runs BEFORE path resolution so we never even
  // stat a sensitive file. resolveSafe also enforces it, but doing it
  // here makes the error message specific and lets us avoid race
  // conditions where the user names a symlink that points at a secret.
  if (pathHasSensitiveSegment(params.path)) {
    throw new PathForbiddenError(
      `Sensitive path rejected (matches secret/key denylist): ${params.path}`,
    );
  }
  const absPath = resolveSafe(params.path);

  // Reject binary heuristically: refuse if extension is in deny list
  if (looksBinary(absPath)) {
    throw new BinaryFileError(`File appears to be binary: ${params.path}`);
  }

  // Check file exists
  let totalSize: number;
  try {
    const s = await stat(absPath);
    if (!s.isFile()) {
      throw new NotFoundError(`Not a regular file: ${params.path}`);
    }
    totalSize = s.size;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") {
      throw new NotFoundError(`File not found: ${params.path}`);
    }
    throw e;
  }

  const raw = await readFile(absPath, "utf-8");
  const allLines = raw.split("\n");
  const totalLines = allLines.length;

  let lines = allLines;
  if (params.lineRange !== undefined) {
    const start = Math.max(1, params.lineRange.start);
    const end = Math.min(totalLines, params.lineRange.end);
    lines = allLines.slice(start - 1, end);
  }

  let content = lines.join("\n");
  let truncated = false;
  if (
    params.tokenBudget !== undefined &&
    estimateTokens(content) > params.tokenBudget
  ) {
    // Roughly cut: budget * chars-per-token characters
    const charBudget = Math.floor(params.tokenBudget * 3.5);
    content = content.slice(0, charBudget);
    truncated = true;
  }

  return {
    content,
    truncated,
    totalLines,
    encoding: "utf-8",
    degradation: [],
  };

  // Suppress unused for size — included to potentially gate behaviour later
  void totalSize;
}

const BINARY_EXTS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".pdf",
  ".zip",
  ".tar",
  ".gz",
  ".exe",
  ".dll",
  ".so",
  ".dylib",
  ".wasm",
  ".woff",
  ".woff2",
  ".ttf",
  ".otf",
  ".mp3",
  ".mp4",
  ".webm",
]);

function looksBinary(absPath: string): boolean {
  const idx = absPath.lastIndexOf(".");
  if (idx === -1) return false;
  const ext = absPath.slice(idx).toLowerCase();
  return BINARY_EXTS.has(ext);
}

export class NotFoundError extends Error {
  public override readonly name = "NotFoundError";
}

export class BinaryFileError extends Error {
  public override readonly name = "BinaryFileError";
}
