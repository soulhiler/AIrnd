import { readFile } from "node:fs/promises";
import type Parser from "web-tree-sitter";
import { langForPath, makeParser } from "./treesitter.js";
import type { IndexedSymbol } from "./store.js";
import type { SymbolKind } from "../types.js";
import { estimateTokens } from "../token-estimate.js";

/**
 * Code indexer using tree-sitter (per ADR 0008). Extracts top-level
 * definitions (functions, classes, methods, interfaces, enums) and their
 * nested children, attaching:
 *  - a `kind/...` hierarchical tag (`kind/callable/function`, etc.),
 *  - path-based tags (inherited from file),
 *  - a `lang/<id>` tag,
 *  - parent symbol linkage (class → method, etc.).
 *
 * Stage 2a coverage: Python, TypeScript, TSX, JavaScript. Other languages
 * fall through to no-op (file symbol only) until WASMs and queries are added.
 */

const SNIPPET_MAX_CHARS = 400;

interface DefinitionRule {
  /** tree-sitter node types that mark a definition */
  nodeTypes: readonly string[];
  symbolKind: SymbolKind;
  /** prefix used to build hierarchical kind/* tag */
  kindTag: string;
}

/**
 * Per-language extraction rules. Identifier node name is heuristic — we ask
 * for the first child named "name" (works for Python / TS / JS / TSX).
 */
const RULES: Record<string, DefinitionRule[]> = {
  python: [
    {
      nodeTypes: ["function_definition"],
      symbolKind: "function",
      kindTag: "kind/callable/function",
    },
    {
      nodeTypes: ["class_definition"],
      symbolKind: "class",
      kindTag: "kind/type/class",
    },
  ],
  typescript: tsRules(),
  tsx: tsRules(),
  javascript: tsRules(),
};

function tsRules(): DefinitionRule[] {
  return [
    {
      nodeTypes: ["function_declaration"],
      symbolKind: "function",
      kindTag: "kind/callable/function",
    },
    {
      nodeTypes: ["method_definition", "method_signature"],
      symbolKind: "method",
      kindTag: "kind/callable/method",
    },
    {
      nodeTypes: ["class_declaration"],
      symbolKind: "class",
      kindTag: "kind/type/class",
    },
    {
      nodeTypes: ["interface_declaration"],
      symbolKind: "interface",
      kindTag: "kind/type/interface",
    },
    {
      nodeTypes: ["enum_declaration"],
      symbolKind: "enum",
      kindTag: "kind/type/enum",
    },
    {
      nodeTypes: ["type_alias_declaration"],
      symbolKind: "type",
      kindTag: "kind/type/typedef",
    },
  ];
}

/** Cached parsers keyed by language id. */
const parsers = new Map<string, Parser>();

async function getParser(langId: string): Promise<Parser | null> {
  const cached = parsers.get(langId);
  if (cached !== undefined) return cached;
  if (!(langId in RULES)) return null;
  try {
    const p = await makeParser(langId);
    parsers.set(langId, p);
    return p;
  } catch (e) {
    console.error(
      `[asp-ref] tree-sitter init failed for ${langId}: ${(e as Error).message}`,
    );
    return null;
  }
}

export function isCodePath(relPath: string): boolean {
  return langForPath(relPath) !== null && langForPath(relPath)! in RULES;
}

export async function indexCodeFile(
  absPath: string,
  relPath: string,
  mtimeMs: number,
): Promise<IndexedSymbol[]> {
  const langId = langForPath(relPath);
  if (langId === null || !(langId in RULES)) return [];

  const parser = await getParser(langId);
  if (parser === null) return [];

  const text = await readFile(absPath, "utf-8");
  const tree = parser.parse(text);
  if (tree === null) return [];

  const out: IndexedSymbol[] = [];
  const fileTags = pathTags(relPath).concat([`lang/${langId}`]);

  // File-level symbol (matches markdown indexer convention).
  const fileId = `file:${relPath}`;
  out.push({
    id: fileId,
    kind: "file",
    scheme: "file",
    path: relPath,
    anchor: null,
    line: null,
    endLine: null,
    parentId: null,
    tokenSize: estimateTokens(text),
    snippet: text.slice(0, SNIPPET_MAX_CHARS),
    mtimeMs,
    tags: fileTags,
  });

  walkAndExtract(
    tree.rootNode,
    langId,
    relPath,
    fileId,
    fileTags,
    text,
    out,
  );
  return out;
}

interface AstNode {
  type: string;
  startPosition: { row: number; column: number };
  endPosition: { row: number; column: number };
  startIndex: number;
  endIndex: number;
  childCount: number;
  child(i: number): AstNode | null;
  childForFieldName(name: string): AstNode | null;
  text: string;
}

function walkAndExtract(
  node: AstNode,
  langId: string,
  relPath: string,
  fileId: string,
  fileTags: string[],
  source: string,
  out: IndexedSymbol[],
  parentId: string = fileId,
): void {
  const rules = RULES[langId];
  if (rules === undefined) return;

  const matchedRule = rules.find((r) =>
    r.nodeTypes.includes(node.type),
  );

  let currentParent = parentId;

  if (matchedRule !== undefined) {
    const name = extractName(node);
    if (name !== null) {
      // Build a scheme like `python` or `typescript` and ID with dotted parent path.
      const parentDotted = parentDottedPath(parentId, relPath);
      const dottedName = parentDotted === null ? name : `${parentDotted}.${name}`;
      const symbolId = `${langId}:${dottedName}`;
      const line = node.startPosition.row + 1;
      const endLine = node.endPosition.row + 1;
      const snippet = source.slice(
        node.startIndex,
        Math.min(node.startIndex + SNIPPET_MAX_CHARS, node.endIndex),
      );
      out.push({
        id: symbolId,
        kind: matchedRule.symbolKind,
        scheme: langId,
        path: relPath,
        anchor: dottedName,
        line,
        endLine,
        parentId,
        tokenSize: estimateTokens(snippet),
        snippet,
        mtimeMs: null, // mtime tracked at file level
        tags: [...fileTags, matchedRule.kindTag],
      });
      currentParent = symbolId;
    }
  }

  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child === null) continue;
    walkAndExtract(
      child,
      langId,
      relPath,
      fileId,
      fileTags,
      source,
      out,
      currentParent,
    );
  }
}

/**
 * Pull the identifier text out of a definition node by walking the named
 * children for a child whose `field name` is "name". Falls back to a child of
 * type "identifier" or "property_identifier".
 */
function extractName(node: AstNode): string | null {
  const byField = node.childForFieldName("name");
  if (byField !== null) return byField.text;
  for (let i = 0; i < node.childCount; i++) {
    const c = node.child(i);
    if (c === null) continue;
    if (
      c.type === "identifier" ||
      c.type === "property_identifier" ||
      c.type === "type_identifier"
    ) {
      return c.text;
    }
  }
  return null;
}

/**
 * Given a parent symbol ID such as `python:myapp.auth` or `file:src/auth.py`,
 * extract the dotted name portion. File-scheme returns null (kicks off
 * dotted-name building from scratch).
 */
function parentDottedPath(parentId: string, relPath: string): string | null {
  const colon = parentId.indexOf(":");
  if (colon === -1) return null;
  const scheme = parentId.slice(0, colon);
  const tail = parentId.slice(colon + 1);
  if (scheme === "file") {
    // Use file basename without extension as the top-level namespace.
    return relPathToModule(relPath);
  }
  // Strip the leading module path we already computed.
  return tail;
}

function relPathToModule(relPath: string): string {
  const dot = relPath.lastIndexOf(".");
  const noExt = dot === -1 ? relPath : relPath.slice(0, dot);
  // Replace path separators with dots so `src/auth.py` → `src.auth`.
  return noExt.replace(/\//g, ".");
}

function pathTags(relPath: string): string[] {
  const parts = relPath.split("/").slice(0, -1);
  const out: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    out.push(parts.slice(0, i + 1).join("/"));
  }
  return out;
}
