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
  rust: [
    {
      nodeTypes: ["function_item"],
      symbolKind: "function",
      kindTag: "kind/callable/function",
    },
    {
      nodeTypes: ["struct_item"],
      symbolKind: "class",
      kindTag: "kind/type/class",
    },
    {
      nodeTypes: ["enum_item"],
      symbolKind: "enum",
      kindTag: "kind/type/enum",
    },
    {
      nodeTypes: ["trait_item"],
      symbolKind: "interface",
      kindTag: "kind/type/interface",
    },
    {
      nodeTypes: ["mod_item"],
      symbolKind: "module",
      kindTag: "kind/container/module",
    },
    {
      nodeTypes: ["type_item"],
      symbolKind: "type",
      kindTag: "kind/type/typedef",
    },
  ],
  go: [
    {
      nodeTypes: ["function_declaration"],
      symbolKind: "function",
      kindTag: "kind/callable/function",
    },
    {
      nodeTypes: ["method_declaration"],
      symbolKind: "method",
      kindTag: "kind/callable/method",
    },
    {
      nodeTypes: ["type_declaration"],
      symbolKind: "type",
      kindTag: "kind/type/typedef",
    },
  ],
  java: [
    {
      nodeTypes: ["method_declaration"],
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
  ],
  c_sharp: [
    {
      nodeTypes: ["method_declaration", "local_function_statement"],
      symbolKind: "method",
      kindTag: "kind/callable/method",
    },
    {
      nodeTypes: ["class_declaration", "struct_declaration"],
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
  ],
  ruby: [
    {
      nodeTypes: ["method", "singleton_method"],
      symbolKind: "method",
      kindTag: "kind/callable/method",
    },
    {
      nodeTypes: ["class"],
      symbolKind: "class",
      kindTag: "kind/type/class",
    },
    {
      nodeTypes: ["module"],
      symbolKind: "module",
      kindTag: "kind/container/module",
    },
  ],
  bash: [
    {
      nodeTypes: ["function_definition"],
      symbolKind: "function",
      kindTag: "kind/callable/function",
    },
  ],
  c: [
    {
      nodeTypes: ["function_definition"],
      symbolKind: "function",
      kindTag: "kind/callable/function",
    },
    {
      nodeTypes: ["struct_specifier", "union_specifier"],
      symbolKind: "class",
      kindTag: "kind/type/class",
    },
    {
      nodeTypes: ["enum_specifier"],
      symbolKind: "enum",
      kindTag: "kind/type/enum",
    },
    {
      nodeTypes: ["type_definition"],
      symbolKind: "type",
      kindTag: "kind/type/typedef",
    },
  ],
  cpp: [
    {
      nodeTypes: ["function_definition"],
      symbolKind: "function",
      kindTag: "kind/callable/function",
    },
    {
      nodeTypes: ["class_specifier", "struct_specifier"],
      symbolKind: "class",
      kindTag: "kind/type/class",
    },
    {
      nodeTypes: ["enum_specifier"],
      symbolKind: "enum",
      kindTag: "kind/type/enum",
    },
    {
      nodeTypes: ["namespace_definition"],
      symbolKind: "module",
      kindTag: "kind/container/module",
    },
    {
      nodeTypes: ["template_declaration"],
      symbolKind: "type",
      kindTag: "kind/type/typedef",
    },
  ],
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

/**
 * An unresolved edge collected during AST walk. `dstName` is a bare
 * identifier (e.g. `login_user`); the indexer resolves it to a symbol ID by
 * anchor match after all files are indexed.
 */
export interface PendingEdge {
  srcSymbolId: string;
  dstName: string;
  kind: "calls" | "uses" | "extends" | "implements" | "imports";
}

export interface CodeIndexResult {
  symbols: IndexedSymbol[];
  edges: PendingEdge[];
}

export async function indexCodeFile(
  absPath: string,
  relPath: string,
  mtimeMs: number,
): Promise<CodeIndexResult> {
  const langId = langForPath(relPath);
  if (langId === null || !(langId in RULES)) {
    return { symbols: [], edges: [] };
  }

  const parser = await getParser(langId);
  if (parser === null) return { symbols: [], edges: [] };

  const text = await readFile(absPath, "utf-8");
  const tree = parser.parse(text);
  if (tree === null) return { symbols: [], edges: [] };

  const symbols: IndexedSymbol[] = [];
  const edges: PendingEdge[] = [];
  const fileTags = pathTags(relPath).concat([`lang/${langId}`]);

  // File-level symbol (matches markdown indexer convention).
  const fileId = `file:${relPath}`;
  symbols.push({
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
    symbols,
    edges,
  );
  return { symbols, edges };
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

const CALL_NODE_TYPES = new Set([
  "call",
  "call_expression",
  "new_expression",
  "method_invocation", // Java
  "object_creation_expression", // Java / C#
  "invocation_expression", // C#
  "command", // Bash
]);

function walkAndExtract(
  node: AstNode,
  langId: string,
  relPath: string,
  fileId: string,
  fileTags: string[],
  source: string,
  out: IndexedSymbol[],
  edges: PendingEdge[],
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
  } else if (CALL_NODE_TYPES.has(node.type)) {
    // Collect a `calls` edge from the enclosing symbol to whatever is being
    // called. Best-effort: the callee identifier is whatever sits at the
    // top of the call expression's left-hand side.
    const calleeName = extractCalleeName(node);
    if (calleeName !== null) {
      edges.push({
        srcSymbolId: currentParent,
        dstName: calleeName,
        kind: "calls",
      });
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
      edges,
      currentParent,
    );
  }
}

/**
 * Extract the called identifier from a call node. Handles `foo()`,
 * `obj.method()`, and `obj.deep.path()` by walking down `.member`.
 */
function extractCalleeName(call: AstNode): string | null {
  // Most grammars expose the function position as the first named child.
  // We walk down `member_expression` / `attribute` to pick the last segment.
  const functionPart = call.childForFieldName("function") ?? call.child(0);
  if (functionPart === null) return null;
  return rightmostIdentifier(functionPart);
}

function rightmostIdentifier(node: AstNode): string | null {
  // attribute / member_expression: take the right child (property).
  if (node.type === "attribute" || node.type === "member_expression") {
    const right =
      node.childForFieldName("attribute") ??
      node.childForFieldName("property") ??
      node.child(node.childCount - 1);
    if (right !== null && right.type !== node.type) {
      return rightmostIdentifier(right);
    }
  }
  if (
    node.type === "identifier" ||
    node.type === "property_identifier" ||
    node.type === "type_identifier"
  ) {
    return node.text;
  }
  // Fallback: scan for any identifier-typed child.
  for (let i = node.childCount - 1; i >= 0; i--) {
    const c = node.child(i);
    if (c === null) continue;
    const n = rightmostIdentifier(c);
    if (n !== null) return n;
  }
  return null;
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
