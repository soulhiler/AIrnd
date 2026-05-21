import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative } from "node:path";

/**
 * Repository walker used by the indexer. Respects `.gitignore` (best-effort,
 * not full git semantics) and hard-coded deny patterns for noise directories.
 *
 * Yields paths relative to repo root.
 */

const HARD_DENY = new Set([
  ".git",
  "node_modules",
  ".gitnexus",
  ".asp",
  "dist",
  "build",
  "__pycache__",
  ".venv",
  "venv",
  ".next",
  ".cache",
  ".turbo",
]);

const SENSITIVE_PATTERNS: RegExp[] = [
  /^\.env(\..*)?$/,
  /\.env$/,
  /\.pem$/,
  /\.key$/,
  /^id_rsa/,
  /^credentials\.json$/,
  /^service-account\.json$/,
];

export interface WalkOptions {
  root: string;
  respectGitignore?: boolean;
  fileFilter?: (relPath: string) => boolean;
}

export async function* walkRepo(opts: WalkOptions): AsyncGenerator<{
  absPath: string;
  relPath: string;
  mtimeMs: number;
  sizeBytes: number;
}> {
  const respect = opts.respectGitignore ?? true;
  const gitignorePatterns = respect
    ? await loadGitignorePatterns(opts.root)
    : [];

  yield* walkDir(
    opts.root,
    opts.root,
    gitignorePatterns,
    opts.fileFilter ?? (() => true),
  );
}

async function* walkDir(
  dirAbs: string,
  root: string,
  ignore: RegExp[],
  filter: (relPath: string) => boolean,
): AsyncGenerator<{
  absPath: string;
  relPath: string;
  mtimeMs: number;
  sizeBytes: number;
}> {
  let entries;
  try {
    entries = await readdir(dirAbs, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (HARD_DENY.has(entry.name)) continue;
    if (isSensitiveName(entry.name)) continue;

    const childAbs = join(dirAbs, entry.name);
    const childRel = relative(root, childAbs);

    if (matchesAny(childRel, ignore) || matchesAny(entry.name, ignore)) {
      continue;
    }

    if (entry.isDirectory()) {
      yield* walkDir(childAbs, root, ignore, filter);
    } else if (entry.isFile()) {
      if (!filter(childRel)) continue;
      try {
        const s = await stat(childAbs);
        yield {
          absPath: childAbs,
          relPath: childRel,
          mtimeMs: Math.floor(s.mtimeMs),
          sizeBytes: s.size,
        };
      } catch {
        // race: file removed between readdir and stat — skip
      }
    }
  }
}

function isSensitiveName(name: string): boolean {
  return SENSITIVE_PATTERNS.some((re) => re.test(name));
}

function matchesAny(path: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(path));
}

async function loadGitignorePatterns(root: string): Promise<RegExp[]> {
  try {
    const content = await readFile(join(root, ".gitignore"), "utf-8");
    const out: RegExp[] = [];
    for (const rawLine of content.split("\n")) {
      const line = rawLine.trim();
      if (line.length === 0 || line.startsWith("#")) continue;
      // Negation patterns (!foo) are not supported in Stage 2a.
      if (line.startsWith("!")) continue;
      const pat = line.replace(/^\//, "").replace(/\/$/, "");
      out.push(globToRegex(pat));
      out.push(globToRegex(pat + "/**"));
    }
    return out;
  } catch {
    return [];
  }
}

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
