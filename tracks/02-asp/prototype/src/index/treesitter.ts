import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import Parser from "web-tree-sitter";

/**
 * Tree-sitter runtime bootstrap. We load WASM grammars from
 * `tree-sitter-wasms/out/` lazily per language. Per ADR 0008:
 * WASM-only setup for portability; no native build tools required.
 *
 * NOTE: pinned to `web-tree-sitter@0.22.x` because `tree-sitter-wasms@0.1.x`
 * grammars are built against tree-sitter ABI 14. Newer web-tree-sitter
 * versions (0.26+) require ABI 15 and fail to load these WASMs. When we
 * upgrade, we must upgrade both packages together.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
// dist/index/treesitter.js → climb to package root → node_modules/...
const PKG_ROOT = join(HERE, "..", "..");
const RUNTIME_WASM = join(PKG_ROOT, "node_modules", "web-tree-sitter", "tree-sitter.wasm");
const GRAMMARS_DIR = join(PKG_ROOT, "node_modules", "tree-sitter-wasms", "out");

let parserInitialized = false;
let initPromise: Promise<void> | null = null;
const langCache = new Map<string, Parser.Language>();

/** File extension → language id used by tree-sitter-wasms. */
const EXT_TO_LANG: Record<string, string> = {
  ".py": "python",
  ".ts": "typescript",
  ".tsx": "tsx",
  ".js": "javascript",
  ".jsx": "javascript",
  ".mjs": "javascript",
  ".cjs": "javascript",
  ".rs": "rust",
  ".go": "go",
  ".java": "java",
  ".cs": "c_sharp",
  ".rb": "ruby",
  ".sh": "bash",
  ".bash": "bash",
};

export function langForPath(relPath: string): string | null {
  const dot = relPath.lastIndexOf(".");
  if (dot === -1) return null;
  const ext = relPath.slice(dot).toLowerCase();
  return EXT_TO_LANG[ext] ?? null;
}

export async function ensureParserReady(): Promise<void> {
  if (parserInitialized) return;
  if (initPromise === null) {
    initPromise = Parser.init({
      // Tell Emscripten where to find the runtime wasm.
      locateFile: () => RUNTIME_WASM,
    });
  }
  await initPromise;
  parserInitialized = true;
}

export async function loadLanguage(langId: string): Promise<Parser.Language> {
  await ensureParserReady();
  const cached = langCache.get(langId);
  if (cached !== undefined) return cached;
  const wasmPath = join(GRAMMARS_DIR, `tree-sitter-${langId}.wasm`);
  // 0.22 API accepts a Uint8Array or string path; we pass bytes for clarity.
  const buf = readFileSync(wasmPath);
  const lang = await Parser.Language.load(buf);
  langCache.set(langId, lang);
  return lang;
}

export async function makeParser(langId: string): Promise<Parser> {
  const lang = await loadLanguage(langId);
  const p = new Parser();
  p.setLanguage(lang);
  return p;
}

export const loadedLanguages = (): string[] => Array.from(langCache.keys());

export type { Parser };
