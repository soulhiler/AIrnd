#!/usr/bin/env python3
"""Toy hierarchical tag generator for the AIrnd repo.

Source of tags:
- File path: tracks/02-asp/lit-review/foo.md -> tags
  ["tracks", "tracks/02-asp", "tracks/02-asp/lit-review"]
- Markdown headings: each "## Heading" inside a file becomes a child
  symbol with inherited path tags + structural section path.

Output: tags.jsonl (one JSON object per line).
"""
from __future__ import annotations

import json
import re
from collections import Counter
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[4]
OUTPUT = Path(__file__).resolve().parent / "tags.jsonl"
IGNORED_DIRS = {".git", "node_modules", ".gitnexus", ".claude"}
IGNORED_PREFIXES = ("docs/TZ",)

HEADING_RE = re.compile(r"^(#{1,6})\s+(.+?)\s*$")


def path_tags(rel_path: Path) -> list[str]:
    parts = rel_path.parts[:-1]
    return ["/".join(parts[: i + 1]) for i in range(len(parts))]


def extract_sections(file_path: Path) -> list[dict]:
    try:
        text = file_path.read_text(encoding="utf-8")
    except (UnicodeDecodeError, IsADirectoryError):
        return []
    sections: list[dict] = []
    path: list[str] = []
    for lineno, line in enumerate(text.splitlines(), 1):
        m = HEADING_RE.match(line)
        if not m:
            continue
        level = len(m.group(1))
        title = m.group(2).strip()
        path = path[: level - 1] + [title]
        sections.append(
            {
                "name": title,
                "level": level,
                "parent_section": "/".join(path[:-1]) if len(path) > 1 else None,
                "line": lineno,
            }
        )
    return sections


def is_ignored(rel: Path) -> bool:
    parts = set(rel.parts)
    if parts & IGNORED_DIRS:
        return True
    return any(str(rel).startswith(p) for p in IGNORED_PREFIXES)


def collect_symbols() -> list[dict]:
    symbols: list[dict] = []
    for md in REPO_ROOT.rglob("*.md"):
        rel = md.relative_to(REPO_ROOT)
        if is_ignored(rel):
            continue
        file_tags = path_tags(rel)
        symbols.append(
            {"symbol": str(rel), "kind": "file", "tags": file_tags}
        )
        for section in extract_sections(md):
            section_tags = list(file_tags) + [f"heading/level-{section['level']}"]
            if section["parent_section"]:
                section_tags.append(f"section/{section['parent_section']}")
            symbols.append(
                {
                    "symbol": f"{rel}#{section['name']}",
                    "kind": "section",
                    "level": section["level"],
                    "parent_section": section["parent_section"],
                    "line": section["line"],
                    "tags": section_tags,
                }
            )
    return symbols


def main() -> None:
    symbols = collect_symbols()
    with OUTPUT.open("w", encoding="utf-8") as f:
        for s in symbols:
            f.write(json.dumps(s, ensure_ascii=False) + "\n")
    print(f"Generated {len(symbols)} symbols -> {OUTPUT.relative_to(REPO_ROOT)}")
    print("Top 20 tags by frequency:")
    counter: Counter[str] = Counter()
    for s in symbols:
        counter.update(s["tags"])
    for tag, n in counter.most_common(20):
        print(f"  {n:5d}  {tag}")


if __name__ == "__main__":
    main()
