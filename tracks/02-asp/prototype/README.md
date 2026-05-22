# ASP Reference Implementation (workname: `asp-ref`)

**Статус:** **Stage 2a — initial scaffold (2026-05-21).** MCP server builds и работает; реализованы baseline operations `asp/readFile` и `asp/listFiles`. SQLite indexing + FTS5 + tree-sitter + `asp/findByTag` + `asp/context` — следующие шаги Stage 2a.

## Простыми словами

Эта папка — будущий дом для **нашей программы-помощника** (рабочее имя `asp-ref`). Сейчас она пустая, и кодить мы пока **не начинаем**. Сначала нужно:

1. Дочитать про похожие программы у других (Aider, Continue, Cline).
2. Принять решения: на каком языке писать, как хранить данные, как разбирать код.

После этого здесь появится сам код. Программу будем делать постепенно — три этапа (маленький, средний, полный), чтобы не утонуть в большом объёме работы.

## Назначение

Clean-room reference implementation ASP-спецификации (см. [ADR 0001](../decisions/0001-mcp-extension-vs-new-protocol.md), [ADR 0003](../decisions/0003-reference-implementation-cleanroom-build-with-gitnexus-parity-5-fixes.md)).

Цели:

1. **Доказать реализуемость ASP-спеки** — спецификация без working code = бумажка.
2. **Исправить 5 UX-проблем GitNexus** — offline-first FTS, fuzzy lookup, standard query language, opt-in instrumentation, explicit degradation (см. [`lit-review/patwari-2026-gitnexus.md`](../lit-review/patwari-2026-gitnexus.md)).
3. **Стать dogfood-tool** — заменить GitNexus в наших research-репозиториях (AIrnd и будущих).
4. **Достичь GitNexus parity по операциям** — все 16 MCP tools покрыты (см. ADR 0003 stages).

## Что **не** делается здесь

- Не fork GitNexus.
- Не API-compatible с GitNexus (несовместимое API — fix #3 = standard query language).
- Не конкурент для enterprise rollout (см. [ADR 0002](../decisions/0002-asp-scope-opensource-agent-ecosystem-only.md): scope = OSS-агенты).

## Pre-conditions для старта кодинга

1. **Gate 0 → 1 закрыт** — литобзор включает Aider RepoMap, LSIF/SCIP, Continue.dev, Cline (их решения влияют на архитектуру).
2. **Минимум 3 архитектурных ADR приняты:**
   - Язык реализации.
   - Storage backend.
   - Parser strategy.
3. **ASP spec v0.1 sketch существует** — хотя бы черновик типов и операций в [`design/03-asp-spec-draft.md`](../design/03-asp-spec-draft.md) (TBD).

## Stages (см. ADR 0003 § Scope creep risk)

- **Stage 2a (MVP-alpha):** 5 операций (`index`, `query`, `context`, `impact`, `detect_changes`) + 2 fixes (offline-first FTS, fuzzy lookup). Dogfood на AIrnd репо.
- **Stage 2b (MVP-beta):** + 6 операций (`rename`, `cypher`, `api_impact`, `shape_check`, `route_map`, `tool_map`) + 2 fixes (standard query language, opt-in instrumentation). Использование ≥1 внешним OSS-агентом.
- **Stage 2c (parity):** + остальные 5 операций (`group_list`, `group_sync`, `list_repos`, + 2 ASP-specific) + 5-й fix (explicit degradation). Extract в отдельный публичный repo.

## Текущее имя

Workname: `asp-ref`. Финальное имя — выбирается перед extract (Stage 2c). До этого не зацикливаемся.

## Tech stack (полностью определён архитектурными ADR Phase 1)

- **Language:** TypeScript on Node.js 20+ LTS ([ADR 0006](../decisions/0006-reference-implementation-language-typescript.md)).
- **MCP integration:** `@modelcontextprotocol/sdk` (официальный TS SDK).
- **Storage backend (Stage 2a):** SQLite via `better-sqlite3` + FTS5 для keyword search ([ADR 0007](../decisions/0007-storage-backend-stage-2a-sqlite-with-fts5.md)). LanceDB / Kùzu — рассматриваются для Stage 2b/2c.
- **AST parsing:** `web-tree-sitter` (WASM bindings; native fallback through config) ([ADR 0008](../decisions/0008-parser-strategy-treesitter-wasm.md)).
- **Query files:** `.scm` per language, начинаем с Aider's queries (Apache 2.0 borrow).
- **Build:** `tsc`. Distribution: npm + `npx asp-ref`.
- **License:** Apache 2.0.

## Файлы здесь

- `README.md` (этот файл) — pre-conditions, stages, current status.
- `package.json` — npm зависимости (MCP SDK, zod, TypeScript).
- `tsconfig.json` — strict TS settings.
- `src/` — TypeScript исходники:
  - `server.ts` — MCP server entry point (wiring + initial scan).
  - `types.ts` — типы (Symbol, AspCapabilities, DegradationEntry).
  - `capabilities.ts` — advertised capabilities.
  - `repo-root.ts` — безопасная resolve-функция (защита от path traversal).
  - `token-estimate.ts` — coarse token counter.
  - `operations/`
    - `read-file.ts` — `asp/readFile` (spec 6.2.1).
    - `list-files.ts` — `asp/listFiles` (spec 6.2.2).
    - `search-files.ts` — `asp/searchFiles` через FTS5 (spec 6.2.3).
    - `find-by-tag.ts` — `asp/findByTag` через таблицу `tags` (spec 6.3.1).
    - `context.ts` — `asp/context` с parent/children (spec 6.3.3).
    - `refresh.ts` — `asp/refresh` синхронный full/incremental (spec 6.4.3).
  - `index/` (расширен):
    - `treesitter.ts` — web-tree-sitter bootstrap, lazy language loading.
    - `code-indexer.ts` — извлечение функций/классов/методов/интерфейсов/типов.
    - `embeddings.ts` — transformers.js + cosine similarity + BLOB encoding.
  - `operations/`:
    - `retrieve.ts` — `asp/retrieve` с vector / keyword / hybrid (RRF) (spec 6.3.2).
- `tests/` — 23 unit/integration теста для индексеров и операций.
  - `index/`
    - `schema.ts` — SQLite DDL (symbols + tags + symbols_fts + triggers).
    - `store.ts` — IndexStore wrapper с prepared statements.
    - `walker.ts` — repo walker (respects .gitignore, deny patterns).
    - `markdown-indexer.ts` — порт нашего toy: file + section symbols, hierarchical tags.
    - `indexer.ts` — fullScan() pipeline.
- `dist/` — скомпилированный JS (генерируется `npm run build`, в `.gitignore`).

## Установка и запуск

```bash
cd tracks/02-asp/prototype
npm install
npm run build
# Запустить сервер, направив на конкретный репо (по умолчанию cwd):
node dist/server.js /path/to/repo
```

В `.mcp.json` корня AIrnd уже добавлена конфигурация — Claude Code загрузит `asp-ref` автоматически.

## Quick test (через stdio)

```bash
# Build first
npm run build

# Send 4 requests via stdio
(echo '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}},"id":1}'
 echo '{"jsonrpc":"2.0","method":"tools/list","params":{},"id":2}'
 echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"asp_capabilities","arguments":{}},"id":3}'
 echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"asp_listFiles","arguments":{"path":"tracks/02-asp/decisions"}},"id":4}'
) | node dist/server.js /home/user/AIrnd
```

## Что работает (Stage 2a — part 3)

- ✅ MCP server bootstrap (stdio transport).
- ✅ `tools/list` advertising **7 tools**.
- ✅ `asp_capabilities` — tier 2, tagSchema hierarchical, retrievalModes [keyword].
- ✅ `asp_readFile` с path traversal protection, line range, token budget enforcement.
- ✅ `asp_listFiles` с glob filters, gitignore respect, recursive option.
- ✅ `asp_searchFiles` через SQLite FTS5 (наш fix #1 — offline-first FTS).
- ✅ **`asp_findByTag`** — hierarchical (prefix) или exact match через таблицу `tags`. Поддерживает фильтр по `kind`.
- ✅ **`asp_context`** — символ + parent + children + body. Properly signals `graph-index` degradation для references/referents (Stage 2c).
- ✅ **`asp_refresh`** — sync full scan. Advertises degradation для unsupported модов (incremental / paths-scoped / async).
- ✅ Persistent index в `.asp/index.db` — schema_version, symbols + tags + symbols_fts (FTS5 external-content).
- ✅ Markdown indexer — file symbols + section symbols + hierarchical tags (порт нашего toy из `ideas/001-toy/`).
- ✅ Background initial scan при пустом индексе. На AIrnd-репо: 48 файлов / 994 символа / ~330мс. `asp_refresh` синхронно — ~500мс.
- ✅ `partial-index` degradation пока background scan не завершён.
- ✅ Error model (codes -32100..-32105 per spec Section 8.1).
- ✅ Empty `degradation: []` array в нормальном режиме (per spec Section 8.2).

## Stage 2a part 4 — tree-sitter + incremental

- ✅ **tree-sitter WASM** через `web-tree-sitter@0.22` + `tree-sitter-wasms@0.1`. Языки: Python, TypeScript, TSX, JavaScript. WASM-only setup, без native build tools (per ADR 0008).
- ✅ **Code indexer** извлекает функции / классы / методы / интерфейсы / enums / type aliases с правильным parent linkage. Symbol IDs формата `<lang>:<dotted.path>` (например, `python:myapp.auth.login_user`).
- ✅ **Hierarchical kind tags** на code symbols: `kind/callable/function`, `kind/type/class`, `kind/type/interface`, и т.д. — per spec Section 7.4.
- ✅ **`lang/<id>` tag** на всех символах (markdown тоже получает `lang/markdown`).
- ✅ **Incremental re-index** по `mtime_ms` через `asp_refresh({scope: "incremental"})`. На повторных запусках без изменений: 46/48 файлов пропускается, 3× быстрее full scan.
- ✅ **Stale file pruning** — удалённые с диска файлы удаляются из индекса автоматически в обоих режимах.

## Stage 2c — impact + mutations

- ✅ **`asp_impact`** — best-effort blast radius через симвовольный edge-граф (`calls` edges). BFS с `direction: upstream | downstream | both`, `maxDepth`, riskLevel heuristic (low/medium/high). Honest `degradation: ["edge-resolution"]` — name-based resolution over-approximates.
- ✅ **`asp_writeFile`** — destructive write с path traversal protection, `ifExists: overwrite|fail|skip`, `createDirs`.
- ✅ **`asp_applyPatch`** — unified-diff applier с hunk-level conflict detection, `dryRun` validation, ifExists semantics. Не fork-safe vs concurrent edits — caller's responsibility.
- ✅ **`edges` таблица** (schema v3) — symbol-to-symbol relationships с `src/dst/kind` индексами в обе стороны. Резолвится после индекса по anchor-name match.
- ✅ **Capabilities бамп**: `impactAnalysis: true`, `mutations: ["writeFile", "applyPatch"]`.
- ✅ **Tests:** 14 новых тестов (impact + mutations). Все 37 проходят.
- 🚧 **LLM rerank** — design зафиксирован в [ADR 0009](../decisions/0009-llm-rerank-design-and-integration-path.md). Реализация отложена до outreach feedback (sampling vs direct LLM choice).

## Stage 2b — embeddings + retrieve + tests

- ✅ **`asp_retrieve`** — двухстадийный retrieval (per spec Section 6.3.2). Modes: `vector` / `keyword` / `hybrid`. Continue.dev pattern: `nRetrieve` → optional rerank → `nFinal`.
- ✅ **Reciprocal Rank Fusion** в hybrid mode — комбинирует BM25 и cosine similarity без калибровки скоров.
- ✅ **Local embeddings** через `@xenova/transformers` (Apache 2.0). Модель по умолчанию: `Xenova/all-MiniLM-L6-v2` (384-dim). Загружается при первом запуске (опционально, через `ASP_ENABLE_EMBEDDINGS=1`).
- ✅ **Graceful degradation** — если модель недоступна (нет сети, нет кеша), vector mode **прозрачно** fallback к keyword + degradation entry `embeddings`.
- ✅ **Embeddings schema** — отдельная таблица в SQLite (`embeddings(symbol_id, dim, model, vector BLOB)`). Schema version bump v1 → v2 с auto-upgrade (additive).
- ✅ **Filter поддержка** — фильтр по tags / kind / pathPrefix перед Stage 2.
- ✅ **Тесты** — 23 теста в `tests/`:
  - `markdown-indexer.test.ts`: file + section extraction, hierarchical tag matching.
  - `code-indexer.test.ts`: Python functions/classes + TypeScript interfaces/functions.
  - `incremental.test.ts`: skip unchanged, pick modified, prune deleted files, prune stale sections.
  - `operations.test.ts`: path traversal, token budget, FTS5 search, findByTag, context.
  - `retrieve.test.ts`: keyword mode, vector fallback, rerank degradation, filter.

## Что **не** работает (Stage 2c+ и follow-ups)

- 🚧 LLM-based rerank — design в [ADR 0009](../decisions/0009-llm-rerank-design-and-integration-path.md), реализация отложена.
- 🚧 Async refresh (`wait: false`) + path-scoped refresh.
- 🚧 Дополнительные tree-sitter языки (Rust, Go, Java, C/C++ доступны в `tree-sitter-wasms`).
- 🚧 ANN индекс для embeddings (сейчас linear scan; OK до ~10k символов с embeddings).
- 🚧 Precise edge resolution — сейчас anchor-based (over-approximates). LSP-style точная resolution — отдельный шаг.
