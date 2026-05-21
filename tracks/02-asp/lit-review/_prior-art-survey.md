# Prior Art Survey — Трек 2 (ASP)

**Дата:** 2026-05-21
**Тип:** **ретроспективный** — написан после ADR 0001, не до. В будущих треках survey должен быть **первым шагом Фазы 0** ([workflow](../../../docs/workflows/prior-art-search.md)).

**Кейс-урок:** Литобзор Трека 2 начался с foundational работ (LSP, MCP, tree-sitter). Глубокий разбор GitNexus был сделан только после сбора 20 use cases. Если бы survey был первым — направление трека («формализация GitNexus API как open RFC») было бы выбрано на день раньше.

---

## Что мы строим (формулировка для поиска)

Open-source стандартизированный интерфейс между LLM-агентами (Cursor, Claude Code, Aider, Continue, Cline) и кодовой базой — typed code-specific operations поверх существующего транспорта.

## Поисковые запросы

| # | Запрос | Источник |
|---|---|---|
| 1 | `"agent code protocol" github` | GitHub, Google |
| 2 | `"MCP for code" specification` | Google |
| 3 | `"AI-native LSP"` | Google, arXiv |
| 4 | `"code context protocol" agent` | Google |
| 5 | `"code knowledge graph" MCP` | Google, GitHub |
| 6 | `topic:code-intelligence stars:>1000` | GitHub |
| 7 | `"AI coding agent" "find references" "rename" "impact analysis"` | Google |
| 8 | arXiv: `LLM code context retrieval` | arXiv |

## Найдено

### 1. GitNexus — **критическая prior art**

- **Ссылка:** <https://github.com/abhigyanpatwari/GitNexus>
- **Maturity:** 39.5k★, 4.5k forks, 288 releases, 1013 commits, последний релиз 2026-05-16 (5 дней назад)
- **License:** PolyForm Noncommercial 1.0.0 — open source, commercial use закрыт
- **Что покрывает:**
  - 16 MCP tools: `query`, `context`, `impact`, `detect_changes`, `rename`, `cypher`, group_*
  - 2 prompts, 7 auto-discoverable resources
  - 16 языков через unified `LanguageProvider`
  - 12-фазный DAG-пайплайн, LadybugDB + 384D embeddings
  - Confidence scoring, MRO, communities, processes
  - Глубокая интеграция: Claude Code (skills + Pre/PostToolUse hooks), Cursor (full), Codex/Windsurf/OpenCode (MCP only)
- **Что НЕ покрывает (наш потенциальный gap):**
  - Открытая спецификация API (только README + tool descriptions)
  - Test suite для compliance
  - Capability discovery between code-intelligence servers
  - Open license (PolyForm Noncommercial блокирует коммерческих агентов)
- **Authors:** Abhigyan Patwari + 45 contributors (Akon Labs, akonlabs.com)
- **Полная запись:** [`patwari-2026-gitnexus.md`](patwari-2026-gitnexus.md)

### 2. agentic-codebase

- **Ссылка:** <https://github.com/agentralabs/agentic-codebase>
- **Maturity:** меньший масштаб, активный проект
- **License:** требует проверки
- **Что покрывает:** semantic code intelligence, impact analysis, coupling detection, prophecy
- **Что НЕ покрывает:** меньшая зрелость, менее богатый tool set, чем GitNexus
- **TODO:** полная lit-review запись

### 3. Aider RepoMap

- **Ссылка:** <https://github.com/Aider-AI/aider> (часть основного репозитория)
- **Maturity:** часть Aider (популярный CLI-агент)
- **License:** Apache 2.0
- **Что покрывает:** tree-sitter ranked symbol graph, intelligent context selection без полной загрузки файлов
- **Что НЕ покрывает:** не выставлен как отдельный MCP-сервис; integrated в Aider
- **TODO:** полная lit-review запись

### 4. Continue codebase indexer

- **Ссылка:** <https://github.com/continuedev/continue>
- **Maturity:** популярное VS Code расширение
- **License:** Apache 2.0
- **Что покрывает:** local vector DB (Lancet protocol), semantic search через `@codebase`
- **Что НЕ покрывает:** не выставлен как MCP-сервис; embedded в Continue
- **TODO:** проверить, есть ли API для re-use

### 5. SCIP / LSIF (Sourcegraph)

- **Ссылка:** <https://github.com/sourcegraph/scip>
- **Maturity:** production-стандарт в Sourcegraph, Codeium
- **License:** Apache 2.0
- **Что покрывает:** код-индекс с символами, references, type hierarchy
- **Что НЕ покрывает:** это формат **индекса**, не **протокол общения** с агентом
- **Релевантность:** building block для ASP-серверов, не конкурент

### 6. Stack Graphs (GitHub)

- **Ссылка:** <https://github.com/github/stack-graphs>
- **Maturity:** production в GitHub code navigation
- **License:** MIT / Apache 2.0
- **Что покрывает:** name resolution algorithm поверх tree-sitter
- **Что НЕ покрывает:** не протокол; алгоритмический компонент
- **Релевантность:** building block

## Оценка покрытия

| Наш use case | Покрыто prior art (где) |
|---|---|
| UC-001 Rename | GitNexus `rename` |
| UC-002 Add field cascade | Частично GitNexus (`rename` + `impact`) |
| UC-003 Change signature | GitNexus + `cypher` |
| UC-004 Impact analysis | GitNexus `impact` |
| UC-005 Extract function | Нет direct (similarity-extract) |
| UC-006 Find refs with context | GitNexus `context` |
| UC-007 Find similar patterns | GitNexus `query` (BM25 + semantic + RRF) |
| UC-008 Tests covering this | GitNexus процессы + `context` |
| UC-009 Dependency graph | GitNexus `cypher` |
| UC-010 Usage examples | GitNexus `query` |
| UC-011 Causal error chain | Нет (требует runtime tracing) |
| UC-012 Stack trace context | Нет; `cypher` достаточно гибок |
| UC-013 Related history | GitNexus `detect_changes` |
| UC-014 Module summary | GitNexus `context` + clusters |
| UC-015 Architecture overview | GitNexus `generate_map` prompt |
| UC-016 Compare implementations | GitNexus `context` для обоих |
| UC-017 Conventions discovery | Нет (только через Leiden clusters) |
| UC-018 Library migration | GitNexus `cypher` |
| UC-019 Dead code | Частично через граф references |
| UC-020 Semantic merge | Нет |

**Покрытие:** **12 из 20 (60%)** напрямую через GitNexus tools, ещё **5 (25%)** через `cypher` escape hatch. **Суммарно ~75–80%.**

## Применение правила решения

Согласно [workflow](../../../docs/workflows/prior-art-search.md):

> **60–80%** → переопределить контрибуцию: **формализация**, **интеграция**, **комплементарная функциональность**.

Решение: **позиция A — ASP как open RFC, формализующая GitNexus-style API.** Подробно см. [ADR 0001](../decisions/0001-mcp-extension-vs-new-protocol.md).

## Сигналы, что gap всё ещё есть

- ⚠️ **License PolyForm Noncommercial** у GitNexus — закрывает commercial agents.
- ⚠️ **Нет открытой спецификации** — только README + tool descriptions.
- ⚠️ **Нет capability discovery** — агент не знает, какие операции поддерживает данный сервер.
- ⚠️ **Нет test suite compliance** — невозможно verify, что альтернативный server совместим.
- ⚠️ **Versioning неявный** — API эволюционирует по committам, без RFC.

Эти 5 сигналов формируют scope нашего contribution. Engineering работа уже сделана GitNexus; формализация — наша.

## Что НЕ сделано (для будущих итераций survey)

- HackerNews search по теме.
- Глубокий просмотр awesome-lists (`awesome-mcp`, `awesome-llm-agents`).
- Прямой контакт с автором GitNexus.
- Проверка closed-source решений: Cursor's internal indexer, GitHub Copilot Workspace, Replit Agent.
- Industry blogs (Sourcegraph blog, OpenAI Codex docs).

Эти источники нужно прогнать перед закрытием Gate 0 → 1.
