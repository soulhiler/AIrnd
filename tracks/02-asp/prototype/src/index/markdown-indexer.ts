import { readFile } from "node:fs/promises";
import type { IndexedSymbol } from "./store.js";
import { estimateTokens } from "../token-estimate.js";

/**
 * Index a markdown file into ASP symbols.
 *
 * Produces:
 *  - One `file:` symbol per file, with path-based hierarchical tags + lang/markdown.
 *  - One `section:` symbol per `#`-`######` heading, with inherited path tags,
 *    heading/level-N tag, and section/{parent-heading} tag.
 *
 * Mirrors the toy implementation in `ideas/001-toy/generate_tags.py`, ported
 * to TypeScript for asp-ref. ADR 0004 hierarchical tag schema.
 */

const HEADING_RE = /^(#{1,6})\s+(.+?)\s*$/;
const SNIPPET_MAX_CHARS = 400;

export async function indexMarkdownFile(
  absPath: string,
  relPath: string,
  mtimeMs: number,
): Promise<IndexedSymbol[]> {
  const content = await readFile(absPath, "utf-8");
  const out: IndexedSymbol[] = [];
  const fileTags = pathTags(relPath).concat(["lang/markdown"]);

  // File-level symbol.
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
    tokenSize: estimateTokens(content),
    snippet: content.slice(0, SNIPPET_MAX_CHARS),
    mtimeMs,
    tags: fileTags,
  });

  // Section symbols.
  const lines = content.split("\n");
  const sectionPath: { title: string; line: number; level: number }[] = [];
  for (let i = 0; i < lines.length; i++) {
    const m = HEADING_RE.exec(lines[i] ?? "");
    if (m === null) continue;
    const level = m[1]!.length;
    const title = m[2]!.trim();
    // Trim ancestors at this level
    while (
      sectionPath.length > 0 &&
      sectionPath[sectionPath.length - 1]!.level >= level
    ) {
      sectionPath.pop();
    }
    const parent =
      sectionPath.length > 0 ? sectionPath[sectionPath.length - 1] : null;
    sectionPath.push({ title, line: i + 1, level });

    const snippet = nextNonHeadingChunk(lines, i);
    const tags = [
      ...fileTags,
      `heading/level-${level}`,
      ...(parent !== null ? [`section/${parent.title}`] : []),
    ];
    out.push({
      id: `section:${relPath}#${title}`,
      kind: "section",
      scheme: "section",
      path: relPath,
      anchor: title,
      line: i + 1,
      endLine: null,
      parentId: parent === null ? fileId : `section:${relPath}#${parent.title}`,
      tokenSize: estimateTokens(snippet),
      snippet,
      mtimeMs,
      tags,
    });
  }

  return out;
}

/**
 * Hierarchical path tags. For `tracks/02-asp/lit-review/foo.md` returns
 * `["tracks", "tracks/02-asp", "tracks/02-asp/lit-review"]` (excluding the
 * filename itself).
 */
function pathTags(relPath: string): string[] {
  const parts = relPath.split("/").slice(0, -1); // drop filename
  const out: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    out.push(parts.slice(0, i + 1).join("/"));
  }
  return out;
}

/**
 * Grab a short content snippet after a heading line, stopping at the next
 * heading (or after SNIPPET_MAX_CHARS).
 */
function nextNonHeadingChunk(lines: string[], headingIdx: number): string {
  const buf: string[] = [];
  let chars = 0;
  for (let i = headingIdx + 1; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (HEADING_RE.test(line)) break;
    buf.push(line);
    chars += line.length + 1;
    if (chars >= SNIPPET_MAX_CHARS) break;
  }
  return buf.join("\n").trim().slice(0, SNIPPET_MAX_CHARS);
}

export const isMarkdownPath = (relPath: string): boolean =>
  /\.(md|mdx|markdown)$/i.test(relPath);
