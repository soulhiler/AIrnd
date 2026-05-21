# GitNexus — MCP-Native Knowledge Graph для AI-агентов

## Metadata

- **Authors:** Abhigyan Patwari + 45 contributors (Akon Labs)
- **Year:** 2026 (v1.6.5 на 2026-05-16, разработка с 2024)
- **Venue:** Open source, GitHub (39.5k★, 4.5k forks, 288 releases, 1013 commits)
- **arXiv / DOI:** —
- **Link:** <https://github.com/abhigyanpatwari/GitNexus> | <https://gitnexus.vercel.app>
- **Citation key:** patwari-2026-gitnexus
- **Дата прочтения:** 2026-05-21
- **Relevance (1–5):** 5
- **Tags:** mcp, code-intelligence, knowledge-graph, prior-art, **critical-evaluation**

## TL;DR

GitNexus — open-source code intelligence engine, индексирующий репозиторий в structured knowledge graph и выставляющий его агентам через **16 MCP tools**. Использует tree-sitter для 16 языков, LadybugDB как графовый бэкенд, 12-фазный DAG-пайплайн с confidence scoring. Глубоко интегрирован с Claude Code (skills + PreToolUse/PostToolUse hooks). **Прямая prior art для нашего трека: реализация большей части функциональности, которую мы хотели специфицировать в ASP.**

## Key claims

- **Архитектура:** 12-фазный DAG-конвейер: `scan → structure → markdown/cobol → parse → routes/tools/orm → crossFile → mro → communities → processes`.
- **Унификация языков:** один `LanguageProvider` interface с `treeSitterQueries`, `importSemantics`, `importResolver`, `exportChecker`, `typeConfig`, `mroStrategy`.
- **Confidence scoring:** 4-уровневая иерархия разрешения импортов с уверенностью 0.95 / 0.9 / 0.5 / fallback.
- **Persistent graph:** LadybugDB с 28+ типов узлов, 16+ типов отношений, FTS-индексы + 384D embeddings (Arctic-embed-xs).
- **Same-graph guarantee:** «Edges emitted by the scope-resolution pipeline and edges emitted by the legacy DAG are indistinguishable to downstream consumers» — гарантия parity между двумя реализациями.
- **Три query-интерфейса** один backend: MCP (stdio), HTTP API, CLI.

## MCP Tools (полный список — критично для нашего анализа)

### Per-repo (11)

| Tool | Что делает | Соответствие нашему UC |
|---|---|---|
| `list_repos` | Discover indexed repositories | — |
| `query` | Process-grouped hybrid search (BM25 + semantic + RRF) | UC-007, UC-010 |
| `context` | 360-degree symbol view — categorized refs, process participation | UC-006, UC-014 |
| `impact` | Blast radius с depth grouping и confidence | **UC-004 точное попадание** |
| `detect_changes` | Git-diff impact — maps changed lines to affected processes | UC-011, UC-013 |
| `rename` | Multi-file coordinated rename (graph + text search, dry-run) | **UC-001 точное попадание** |
| `cypher` | Raw Cypher graph queries | универсальный escape hatch |
| `group_list/sync/contracts/query/status` | Cross-repo operations (контракты, execution flows) | расширение наших UC |

### Prompts (2)

- `detect_impact` — pre-commit change analysis.
- `generate_map` — Mermaid architecture diagrams. (UC-015)

### Resources (auto-discoverable)

- `gitnexus://repos`, `repo/{name}/context`, `clusters`, `processes`, `schema` (Cypher schema).

## Methodology / технические решения

1. **Static phase graph вместо плагин-системы** (compile-time type safety, отказ от runtime гибкости в пользу correctness).
2. **DAG разрешения вызовов:** 6-этапный pipeline `extract-call → classify-form → infer-receiver → select-dispatch → resolve-target → emit-edge`. Два language-specific hook-point (receiver + dispatch).
3. **Scope-Resolution Pipeline (RFC #909)** — параллельный путь для мигрированных языков (Python, C#), управляется флагом `MIGRATED_LANGUAGES`.
4. **CI parity check** (`ci-scope-parity.yml`) — на каждый PR проверяет, что обе реализации эмитят неразличимые рёбра.
5. **Chunked parsing** (~20 MB) с worker pool, sequential fallback для отладки.
6. **AI-skills auto-generation:** Leiden community detection → per-cluster `SKILL.md` файлы.

## Сравнение с другими подходами

| Подход | Индекс | Retrieval | Архитектурное знание |
|---|---|---|---|
| **GitNexus** | tree-sitter + LadybugDB граф | hybrid (BM25 + semantic + RRF) | first-class через cypher / impact / context |
| **Aider RepoMap** | tree-sitter ranked symbol graph | ranking by usage | partial |
| **Continue codebase indexer** | local vector DB (Lancet) | semantic search | weak (плоский индекс) |
| **Cline** | LLM-driven file reads | no persistent index | inline |

GitNexus — **самое продвинутое open-source решение** в этой категории.

## Claude Code integration (полная)

- **All 16 MCP tools.**
- **4 agent skills** в `.claude/skills/`: Exploring, Debugging, Impact Analysis, Refactoring.
- **PreToolUse hooks** — enriches search with graph context.
- **PostToolUse hooks** — detects stale index after commits, prompts reindex.
- **Auto-generated:** `AGENTS.md`, `CLAUDE.md`, repo-specific `SKILL.md` per functional cluster.
- **Setup:** `npx gitnexus setup` — one-time global MCP config.

Поддерживаемые редакторы: Claude Code (полная), Cursor (полная), Codex (MCP + skills), Windsurf (MCP only), OpenCode (MCP + skills).

## Gap (для нашего трека) — критическое переосмысление

GitNexus покрывает **минимум 12 из наших 20 use cases напрямую** через свои tools:

- ✅ UC-001 Rename → `rename`
- ✅ UC-003 Change signature → через `cypher` + `rename`
- ✅ UC-004 Impact analysis → `impact`
- ✅ UC-006 Find references → `context`
- ✅ UC-007 Find similar patterns → `query` (BM25 + semantic + RRF)
- ✅ UC-008 Tests covering this → процессы + `context`
- ✅ UC-009 Dependency graph → `cypher`
- ✅ UC-010 Usage examples → `query`
- ✅ UC-013 Related history → `detect_changes`
- ✅ UC-014 Module summary → `context` + cluster info
- ✅ UC-015 Architecture overview → `generate_map`
- ✅ UC-016 Compare implementations → `context` для обоих

Не покрывается напрямую:

- UC-002 Add field cascade — частично (через `rename` + `impact`)
- UC-005 Extract function — нет встроенного similarity-extract
- UC-011 Causal error chain — нет runtime tracing
- UC-012 Stack trace context — нет (но `cypher` достаточно гибок)
- UC-017 Conventions discovery — нет (только через Leiden clusters)
- UC-018 Library migration — нет (но `cypher` достаточно)
- UC-019 Dead code — частично через граф references
- UC-020 Semantic merge — нет

**Это переворачивает анализ ADR 0001.** Изначальная гипотеза «ASP = typed code capability over MCP» строилась на предположении, что **никто** не делает code-specific operations через MCP стандартизированно. **GitNexus делает.** 16 ad-hoc tools, но в production, с серьёзной кодовой базой и адопшном.

## Open questions (после прочтения)

1. **Является ли GitNexus de facto standard?** 39.5k★ + интеграция с Claude Code/Cursor/Codex/Windsurf — серьёзный adoption. Возможно, его tool names стали implicit standard.
2. **Достаточно ли формализации поверх GitNexus tools?** Может, ASP — это не «новый протокол», а **«RFC, формализующий GitNexus API как открытый стандарт»**?
3. **Что мешает использовать GitNexus напрямую?** PolyForm Noncommercial license — коммерческие агенты могут не хотеть commit'иться к нему. Это **главный аргумент** для отдельной спецификации.
4. **Кто ещё работает в этом пространстве?** GitNexus — лидер, но нет ли других реализаций, которые могли бы войти в стандарт?
5. **Существует ли уже формальная спецификация?** Если кто-то уже написал RFC по code-MCP-tools — нам нужно его найти и присоединиться.

## Related work cited (изучить дальше)

- **Akon Labs / akonlabs.com** — коммерческое расширение GitNexus. Понять бизнес-модель: чем хотят монетизировать, и что закрыто vs открыто.
- **Leiden community detection** — алгоритм кластеризации, используемый GitNexus. Может быть релевантен для UC-015.
- **LadybugDB** — графовая БД. Альтернативы (Neo4j, KuzuDB) для альтернативных реализаций ASP-сервера.
- **Arctic-embed-xs (384D)** — embedding модель GitNexus. Для сравнения с другими code embeddings.

## Личные заметки и implications

### Что GitNexus подтверждает

1. **Hypothesis confirmed:** code-aware MCP-сервер — востребованная, успешная архитектура. 39.5k★ — это объективная market validation.
2. **Architecture validated:** наша гипотеза «MCP transport + code-specific operations» — это **именно то, что делает GitNexus**.
3. **Use cases validated:** 12 из 20 наших UC GitNexus решает напрямую через tools, остальные доступны через `cypher` escape hatch.

### Что меняет картину для ADR 0001

**Изначальная гипотеза:** «ASP — typed code capability over MCP, расширяющий MCP стандартизированными code-specific операциями».

**Проблема:** GitNexus уже делает это — без формальной спецификации, но с 16 production-tested tools, real adoption, активной разработкой, deep editor integrations.

**Возможные позиции для ASP:**

#### Позиция A: ASP = RFC, формализующий de facto operations

- Изучить GitNexus API детально → выделить стабильное core → опубликовать как формальную спецификацию.
- Цель: интероперабельность для других реализаций (включая коммерческие).
- Контрибуция: спецификация + test suite + reference implementation помельче GitNexus.
- Риск: GitNexus может проигнорировать и продолжать как есть.

#### Позиция B: ASP = тонкая семантическая прослойка над любым code-MCP

- Не специфицировать конкретные операции, а определить **протокол capability negotiation** для code-MCP-серверов.
- Например: capability `code/findReferences`, для которой любой сервер (GitNexus, наш, third-party) может объявить поддержку.
- Контрибуция: типизированный protocol layer + capability registry.
- Риск: слишком абстрактно, чтобы быть полезным.

#### Позиция C: закрыть трек

- GitNexus покрывает 80% задачи лучше, чем мы сможем за 12 месяцев в одиночку.
- Контрибуция: вклад в GitNexus как community contributor / документация.
- Что освобождается: время на другие треки (Intent IR, Verifiable Zones).

#### Позиция D: специализация в подобласти

- Пример: «протокол для verification-aware code intelligence», который связывает code-MCP с SMT-верификацией (пересечение с Треком 3).
- Контрибуция: novel niche, где GitNexus не работает.
- Риск: слишком узко для standalone-публикации.

### Моя ставка для обсуждения

Скорее всего **Позиция A с движением в сторону B** — формализовать существующее (GitNexus tool API + что-то ещё, если найдём) как открытый стандарт, и добавить capability negotiation для разнообразия реализаций.

Но это **архитектурное решение**, которое не следует принимать здесь. Оно требует обсуждения с человеком (Романом) и, возможно, прямого диалога с авторами GitNexus.

### Immediate next step

Прежде чем закрывать ADR 0001, требуется:

1. **Глубокий разбор GitNexus tool API** — точные JSON schemas, response formats. Прочитать `packages/mcp-server/src/` напрямую.
2. **Поиск других реализаций** — есть ли GitHub MCP servers, тренировка которых пересекается с GitNexus.
3. **Контакт с автором GitNexus** — Abhigyan Patwari. Узнать, есть ли намерения стандартизировать API.
4. **Переоценка scope трека** — может, фокус сужается до конкретного gap (например, formalization layer), а не «целого ASP».
