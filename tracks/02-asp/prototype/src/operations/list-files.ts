import { readdir, stat, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { z } from "zod";
import { getRepoRoot, resolveSafe } from "../repo-root.js";
import {
  SENSITIVE_DIR_NAMES,
  isSensitiveBasename,
} from "../security.js";
import type { DegradationEntry } from "../types.js";

/**
 * `asp/listFiles` — spec Section 6.2.2.
 * Safety: read-only.
 */

const ListFilesParamsSchema = z.object({
  path: z.string().optional(),
  recursive: z.boolean().optional(),
  include: z.array(z.string()).optional(),
  exclude: z.array(z.string()).optional(),
  respectGitignore: z.boolean().optional(),
  tokenBudget: z.number().int().positive().optional(),
});

export type ListFilesParams = z.infer<typeof ListFilesParamsSchema>;

export interface FileEntry {
  path: string;
  kind: "file" | "directory";
  sizeBytes?: number;
}

export interface ListFilesResult {
  files: FileEntry[];
  truncated: boolean;
  degradation: DegradationEntry[];
}

export async function listFilesOp(
  rawParams: unknown,
): Promise<ListFilesResult> {
  const params = ListFilesParamsSchema.parse(rawParams);
  const startRel = params.path ?? ".";
  const startAbs = resolveSafe(startRel);
  const recursive = params.recursive ?? false;
  const include = params.include?.map(globToRegex) ?? null;
  const exclude = params.exclude?.map(globToRegex) ?? [];
  const respectGitignore = params.respectGitignore ?? true;
  const root = getRepoRoot();

  const gitignorePatterns = respectGitignore
    ? await loadGitignorePatterns(root)
    : [];

  const out: FileEntry[] = [];
  const degradation: DegradationEntry[] = [];
  await walk(
    startAbs,
    root,
    recursive,
    include,
    [...exclude, ...gitignorePatterns],
    out,
  );

  return {
    files: out,
    truncated: false, // TODO Stage 2a: token-budget truncation
    degradation,
  };
}

async function walk(
  abs: string,
  root: string,
  recursive: boolean,
  include: RegExp[] | null,
  exclude: RegExp[],
  out: FileEntry[],
): Promise<void> {
  const entries = await readdir(abs, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === ".git" || entry.name === "node_modules") continue;
    if (SENSITIVE_DIR_NAMES.has(entry.name)) continue;
    if (isSensitiveBasename(entry.name)) continue;
    const entryAbs = join(abs, entry.name);
    const entryRel = relative(root, entryAbs);
    const isDir = entry.isDirectory();

    if (matchesAny(entryRel, exclude)) continue;

    if (isDir) {
      out.push({ path: entryRel + "/", kind: "directory" });
      if (recursive) {
        await walk(entryAbs, root, recursive, include, exclude, out);
      }
    } else if (entry.isFile()) {
      if (include !== null && !matchesAny(entryRel, include)) continue;
      const s = await stat(entryAbs);
      out.push({
        path: entryRel,
        kind: "file",
        sizeBytes: s.size,
      });
    }
  }
}

/**
 * Convert a glob pattern to a regex. Supports `*` (segment) and `**` (any).
 * Conservative: this is not full gitignore semantics.
 */
function globToRegex(glob: string): RegExp {
  let pattern = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*") {
      if (glob[i + 1] === "*") {
        pattern += ".*";
        i++;
      } else {
        pattern += "[^/]*";
      }
    } else if (c === "?") {
      pattern += "[^/]";
    } else if (c === "." || c === "+" || c === "(" || c === ")" || c === "|") {
      pattern += "\\" + c;
    } else {
      pattern += c;
    }
  }
  return new RegExp(`^${pattern}$`);
}

function matchesAny(path: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(path) || p.test(path.replace(/\/$/, "")));
}

async function loadGitignorePatterns(root: string): Promise<RegExp[]> {
  try {
    const content = await readFile(join(root, ".gitignore"), "utf-8");
    const out: RegExp[] = [];
    for (const rawLine of content.split("\n")) {
      const line = rawLine.trim();
      if (line.length === 0 || line.startsWith("#")) continue;
      // Strip leading slash, treat rest as glob
      const pat = line.replace(/^\//, "");
      out.push(globToRegex(pat));
      // Also match files under matched directories
      out.push(globToRegex(pat + "/**"));
    }
    return out;
  } catch {
    return [];
  }
}
