# 0008. Parser strategy — tree-sitter WASM с возможностью native fallback

- **Дата:** 2026-05-21
- **Статус:** accepted
- **Связанные ADR:** [0003](0003-reference-implementation-cleanroom-build-with-gitnexus-parity-5-fixes.md), [0006](0006-reference-implementation-language-typescript.md), [0007](0007-storage-backend-stage-2a-sqlite-with-fts5.md)

## Простыми словами

Чтобы понять структуру кода (где функция, где класс, где ссылка), нужен **парсер** — программа, которая разбирает код по грамматике языка программирования. У нас три варианта:

1. **tree-sitter WASM** — самый популярный парсер в мире, упакованный в WASM-модуль (работает в любом браузере и Node.js). Поддерживает 100+ языков программирования.
2. **tree-sitter Native** — то же, но через нативные C-bindings. Быстрее, но сложнее устанавливать.
3. **LSP** — каждый язык имеет свой Language Server (как для VS Code). Очень точно, но требует установки отдельного сервера для каждого языка.

Решение: **tree-sitter WASM** для начала. Причины:

1. **Установка одной командой.** `npm install web-tree-sitter` — и парсеры для 100+ языков скачиваются автоматически.
2. **Работает везде** — Linux, macOS, Windows, без компиляции под архитектуру.
3. **Aider и GitNexus уже на tree-sitter** — мы используем тот же подход, что зрелые проекты.
4. **Если будет медленно — переключимся на native** через condition в конфиге. Архитектурно не надо менять.

## Context

ASP server должен разобрать исходный код, чтобы:

- **Извлекать символы** (функции, классы, методы) для `asp/findByTag` и `asp/context`.
- **Находить ссылки** (кто вызывает кого) для `asp/impact`.
- **Чанкировать код** по семантическим границам для `asp/retrieve` (как Continue.dev).

Lit-review показал три подхода:

- **tree-sitter** — Aider RepoMap, Continue.dev, GitNexus все используют. Universal language coverage, fast incremental parsing, query language для извлечения patterns.
- **LSP-based** — точнее (язык-server понимает semantics), но требует install LSP per language; heavyweight для simple use cases.
- **Custom regex/AST per language** — used by Aider RepoMap для Pygments fallback. Pragmatic для languages без tree-sitter parser. Не universal solution.

Для Stage 2a (MVP-alpha) приоритет: **breadth of language coverage** > **maximum semantic precision**. Это favoriting tree-sitter.

Внутри tree-sitter — два варианта bindings:

- **`web-tree-sitter` (WASM)**: WebAssembly module. Same code Linux/macOS/Windows/browser. Slower than native by 2-5×.
- **`tree-sitter` (native, через node-gyp)**: C bindings. Faster. Requires native build toolchain (Python + make + C compiler) на installation.

## Decision

**Stage 2a parser = `web-tree-sitter` (WASM bindings).** Native — opt-in через config.

Конкретно:

1. **Default parser:** `web-tree-sitter` package. WASM-only setup.
2. **Language grammars:** загружаются on-demand из `tree-sitter-language-pack` или per-language packages (e.g., `tree-sitter-python`, `tree-sitter-typescript`).
3. **Query files:** `.scm` queries для tag extraction (definitions, references). Borrow Aider's queries как starting point (Apache 2.0 compatible).
4. **Cache compiled queries** in-memory per server lifetime.
5. **Pygments-style fallback** для languages без tree-sitter parser: tokenize as plain text, extract identifier patterns. Borrow from Aider (Apache 2.0).
6. **Native fallback:** config option `parser.engine: "native"` — uses `tree-sitter` native bindings if installed. Default `"wasm"`.
7. **Cold-start optimization:** lazy-load language parsers (don't load Rust parser if repo has no Rust).

## Consequences

### Positive

- **Universal installation.** WASM works on any Node.js without native build tools. **Это снимает major friction** для users — не нужен `python3-dev`, `make`, C compiler.
- **100+ languages out of the box** через `tree-sitter-language-pack` или official packages.
- **Familiar to OSS-agent ecosystem.** Aider, Continue.dev, GitNexus — все на tree-sitter. Maintainers smоgут читать наш код / queries.
- **Incremental parsing** built-in. Если файл changes — only re-parse affected ranges.
- **Same parser as Aider** — мы можем borrow query files (`.scm`) и Pygments fallback (Apache 2.0).

### Negative

- **2-5× slower than native** в pure parsing benchmarks. **Mitigation:**
  - Most time на indexing не в parsing, а в I/O + storage writes — parsing rarely bottleneck.
  - Profile Stage 2a; если parsing dominates — switch via config to native.
  - Cache parsed ASTs aggressively (mtime-keyed).
- **WASM blob ~5-10MB** per language grammar. **Mitigation:** lazy-load only languages present in repo.
- **No semantic understanding.** tree-sitter — syntactic parsing only. Won't know что variable `x` is the same `x` across scopes без manual analysis. **Mitigation:** for Stage 2a — fine (we're tagging structural symbols, не tracking variable identity). For full reference resolution в Stage 2c — может потребоваться augment с LSP integration.
- **Tree-sitter parsers vary в quality** per language. Python / JavaScript / TypeScript excellent; less popular languages (Brainfuck, Pony) may have stub parsers. **Mitigation:** advertise supported languages via capability `parserCoverage: ["python", "typescript", ...]`.

### Necessary follow-ups

- **`prototype/package.json`:** include `web-tree-sitter`, language grammar packages.
- **`prototype/queries/`:** directory с `.scm` query files per language. Initial set: Python, TypeScript, JavaScript, Rust, Go (most common).
- **Spec capability:** добавить в Section 5.2 capability `parserCoverage: string[]` для language coverage advertisement.
- **Spec capability:** add `parserEngine: "wasm" | "native"` (informational).
- **ADR 0011 (potential):** если parsing performance в Stage 2a/2b становится bottleneck — формальное решение по native vs WASM на основе measurements.
- **`degradation` feature reserved:** добавить `language-parser-missing` (уже в Section 8.2 spec).

## Alternatives considered

### Alternative A: tree-sitter native (через `tree-sitter` package + node-gyp)

Pros: 2-5× faster parsing. Lower memory.

Cons:

- **Native build toolchain required** для installation. На Windows — Visual Studio Build Tools. На Linux — `python3-dev`, `make`, gcc/clang. **Major friction.**
- **Architecture-specific binaries** — separate builds per arch (x64, arm64, aarch64).
- **Less reproducible** in containers / CI.

Отклонено как default. Опция через config — accepted.

### Alternative B: LSP integration

Use existing Language Servers (`pyright`, `tsserver`, `rust-analyzer`) for parsing + semantic.

Pros: Maximum semantic precision (real type info, real reference resolution).

Cons:

- **Per-language LSP install.** User должен install + configure 10+ LSPs.
- **Process management overhead** — spawn LSP per language.
- **Inconsistent quality** across languages.
- **Major scope creep** для Stage 2a — building LSP gateway = different project.

Отклонено для Stage 2a. **Potential для Stage 2c** — особенно для reference resolution в impact analysis.

### Alternative C: Custom parser per language

Write minimal regex / hand-rolled parsers for top 5-10 languages.

Pros: Total control. No external dependencies.

Cons:

- **Massive engineering effort.** Each language — weeks-months of work.
- **Maintenance burden.** Languages evolve; we'd need to track syntax changes.
- **No way to reach 100+ languages** that tree-sitter has.

Отклонено outright.

### Alternative D: Aider RepoMap fork

Take Aider's RepoMap module + tree-sitter queries directly. Less code to write.

Pros: Battle-tested.

Cons:

- **Aider RepoMap is Python.** We're TypeScript (ADR 0006). Need port.
- **Aider RepoMap is tightly integrated** with Aider's prompt builder. Not clean-room module.
- **Per ADR 0003 — clean-room implementation, не fork.** GitNexus и Aider обоих избегаем как code base.

Отклонено: borrow ideas (queries, fallback patterns) — yes. Fork — no.

## References

- **`web-tree-sitter` package:** <https://www.npmjs.com/package/web-tree-sitter>.
- **tree-sitter native:** <https://github.com/tree-sitter/node-tree-sitter>.
- **tree-sitter docs:** <https://tree-sitter.github.io/tree-sitter/>.
- **Aider RepoMap source** (queries для borrowing): <https://github.com/Aider-AI/aider/tree/main/aider/queries>.
- **Brunsfeld 2018 tree-sitter lit-review** (already в нашем lit-review).
- **GitNexus lit-review** — также uses tree-sitter; reference.
- **ADR 0006** (language: TypeScript).
- **ADR 0007** (storage: SQLite).
