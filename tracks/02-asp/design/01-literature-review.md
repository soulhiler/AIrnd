# Литературный обзор: Agent Server Protocol (ASP)

**Версия:** 0.2 (draft, после ADR 0001)
**Дата:** 2026-05-21
**Трек:** 2 — Agent Server Protocol
**Статус:** обоснование принятой [ADR 0001](../decisions/0001-mcp-extension-vs-new-protocol.md), вход в Gate 0 → 1.

---

## Abstract

Современный стек разработки исторически складывался без учёта того, что в цепочке «человек → инструмент → язык → компилятор → железо» появилось новое звено — LLM-агент. Существующие протоколы интеграции (LSP для редакторов, MCP для тулинга агентов) либо спроектированы под другие потребности (LSP — под точечные запросы редактора), либо слишком обобщены, чтобы выражать code-specific семантику естественно (MCP — generic context bus). В результате каждый агент реализует свою retrieval-логику с нуля, дублирующую работу и расходящуюся в качестве. Но за последние полтора года появились code-intelligence MCP servers — особенно **GitNexus** (39.5k★, 16 MCP tools) — которые де-факто решили большую часть инженерной задачи без формальной открытой спецификации.

Этот обзор фиксирует текущее состояние области, идентифицирует gap и обосновывает направление для Трека 2: **ASP — открытая RFC-спецификация, формализующая GitNexus-style MCP-based code intelligence API как открытый стандарт**, на основе анализа уже работающих implementations (GitNexus как primary reference, agentic-codebase / Aider RepoMap / Continue indexer как secondary).

---

## 1. Введение: проблема

### 1.1 N×M на новом уровне

LSP решил классическую M×N-проблему: M редакторов × N языков → M+N через стандартизированный протокол. Сегодня появилась новая комбинаторика: **K LLM-агентов × N кодовых баз × L языков**, при этом каждый агент реализует retrieval и context management индивидуально.

Конкретные следствия:

- **Дублирование инженерной работы.** Aider, Continue, Cline, Cursor, Claude Code — каждый разрабатывает свой индексер, свою retrieval-стратегию, своё представление кода в контексте.
- **Расхождение качества.** Бенчмарки фиксируют 25% разницу в accuracy между Continue и Cline на одной задаче ([DevToolReviews 2026](https://www.devtoolreviews.com/reviews/cline-vs-continue-dev-2026)) — для тех же кодовых баз.
- **Отсутствие интероперабельности.** Авторы code-intelligence инструментов не могут «один раз реализовать сервер, поддержать все агенты», как это сделали авторы LSP для редакторов.

### 1.2 Эмпирическое подтверждение

Анализ 20 типичных операций агента ([`02-use-cases.md`](02-use-cases.md)) показывает:

- **Composability** требуется для 60% задач (вместо текущих N+1 запросов).
- **Типизация** нужна для 70% (агенты теряются на ad-hoc tool descriptions, что независимо подтверждается работой [arXiv:2602.14878](https://arxiv.org/abs/2602.14878) «MCP Tool Descriptions Are Smelly!»).
- **Семантические primitives** (findReferences, dependencies, impactAnalysis) фигурируют в ≥10 use cases как first-class.

### 1.3 Гипотеза (после анализа prior art)

**ASP — открытая RFC-спецификация для code intelligence MCP servers**, формализующая де-факто API (на основе GitNexus как primary reference) в виде открытого стандарта с capability discovery, test suite и reference implementation под permissive license.

Гипотеза опирается на:

- **GitNexus** (39.5k★, см. § 4.3) уже реализовал большую часть code-intelligence MCP-функционала — engineering работа сделана.
- **License gap:** PolyForm Noncommercial GitNexus блокирует коммерческое использование — индустрии нужна открытая альтернатива.
- **Architecture gap:** существующие реализации не имеют общего интерфейса — agents с lock-in к конкретному серверу.
- **20 use cases** ([`02-use-cases.md`](02-use-cases.md)) — эмпирическое основание для отбора operations в стандарт.

Альтернативы (свой протокол; набор слабо-типизированных MCP tools; полное закрытие трека) рассмотрены и отклонены в [ADR 0001](../decisions/0001-mcp-extension-vs-new-protocol.md).

---

## 2. Code-aware protocols

### 2.1 Language Server Protocol (LSP)

[Microsoft, 2016 → 3.17 (2022)](../lit-review/microsoft-2022-lsp-spec.md). Стандартизированный протокол на JSON-RPC 2.0 для общения редакторов с language servers. Решает M×N через клиент-серверную архитектуру с capability negotiation.

**Что LSP даёт хорошо:**

- **Транспортная модель.** JSON-RPC поверх stdio — простая, проверенная.
- **Lifecycle.** initialize → initialized → работа → shutdown.
- **Capability negotiation.** Серверы и клиенты согласовывают возможности, можно расширять без breaking changes.
- **Адопшн.** Принят VS Code, Neovim, Emacs, Sublime, JetBrains, Helix.

**Что LSP плохо подходит для агентов:**

- **Position-centric.** Большинство операций принимают `(uri, line, character)`. Агент думает символами и модулями, не курсорами.
- **Stateful per-document.** Сервер хранит in-memory модель документа, синхронизируется через `didChange`. Агенту нужен snapshot-based доступ.
- **Атомарные запросы.** Один request → один response. Композиция (find ref → chunk → rank) требует N+1 вызовов и накопления latency.
- **Нет cost-awareness.** Размер ответа не ограничен — для LLM это означает переполнение контекста.

LSP — отличный референс **дизайна транспорта**, но не **семантической модели** для агента.

### 2.2 Параллельные протоколы Microsoft

**DAP (Debug Adapter Protocol)** — debugger-editor общение, тот же JSON-RPC stack. Показывает, что LSP-стиль работает для разных доменов.

**BSP (Build Server Protocol)** — build systems. Также параллельный протокол, доказывающий состоятельность подхода «один transport, разные domain protocols».

Эти протоколы — индирект-аргумент в пользу того, что ASP может быть **четвёртым** в этой семье, либо capability одного из них.

---

## 3. Agent integration protocols

### 3.1 Model Context Protocol (MCP)

[Anthropic, ноябрь 2024 → schema 2025-11-25](../lit-review/anthropic-2024-mcp-spec.md). С декабря 2025 — Linux Foundation (Agentic AI Foundation). Принят OpenAI, Microsoft, Google, Cloudflare. >20M weekly downloads SDK.

**Архитектура:**

- **Host** — приложение (Claude Desktop, IDE, агент).
- **Client** — одна инстанс на каждый server.
- **Server** — предоставляет resources / tools / prompts.

**Core primitives:**

| Primitive | Назначение |
|---|---|
| Resources | Read-only данные с URI |
| Tools | Callable functions с side-effects, типизированные args, hints (readOnly/destructive/idempotent) |
| Prompts | Параметризованные templates |
| Sampling | Запрос LLM-completion у host |
| Roots | Accessible directories |
| Tasks | Async operations с TTL и polling |
| Pagination, Progress, Cancellation | Infrastructure |

**MCP явно вдохновлён LSP:** «MCP re-uses the message-flow ideas of the Language Server Protocol (LSP) and is transported over JSON-RPC 2.0».

**Что MCP даёт для code-agent:**

- Transport, lifecycle, capability negotiation — готовы.
- Pagination и progress — критично для больших code-результатов.
- Resource subscriptions — аналог LSP `didChange` для file watching.

**Чего MCP не даёт:**

- **Code-specific семантика как first-class.** Symbols, references, type hierarchy, call graph — нет в schema. Можно через `tools/call`, но без типизации.
- **Composability на уровне запросов.** Tools атомарны. Composite tools — soft convention, не структурная фича.
- **Token / cost awareness для responses.** ModelPreferences есть для sampling, но response budget — нет.

### 3.2 Критика MCP в литературе

**arXiv:2602.14878 «MCP Tool Descriptions Are Smelly!»** — авторы показывают, что **низкое качество tool descriptions** систематически ухудшает agent performance. Это прямой аргумент за **типизированные primitives** вместо open-ended tools.

**arXiv:2504.03767 «MCP Safety Audit»** — security issues в дизайне MCP. Релевантно для адопшна ASP в production контекстах.

---

## 4. Code intelligence foundations

### 4.1 Tree-sitter

[Max Brunsfeld, 2018](../lit-review/brunsfeld-2018-tree-sitter.md). GLR-парсер с incremental updates и error recovery. Поддерживает 200+ языков с единым API.

**Что даёт ASP:** естественный foundation индексера. AST как структура для семантических операций.

**Что не даёт:**

- Name resolution (нужен [Stack Graphs](https://github.com/github/stack-graphs) сверху).
- Type information (нужны LSP-серверы целевых языков).
- Cross-file отношения (нужен собственный индекс).

### 4.2 Code index forматы

**SCIP / LSIF** (Sourcegraph) — стандартизированные форматы code index с информацией о символах, references, type hierarchy. Используются Sourcegraph, Codeium.

**Stack Graphs** (GitHub) — name resolution алгоритм поверх tree-sitter, инкорпорированный в GitHub code navigation.

Это **строительные блоки** для ASP-серверов, не альтернативы протоколу. Реальный ASP-сервер будет использовать tree-sitter + Stack Graphs (или SCIP-индекс) для построения своих ответов.

### 4.3 Code knowledge graphs

**[GitNexus](../lit-review/patwari-2026-gitnexus.md)** (Abhigyan Patwari + Akon Labs, 2024–2026) — **критическая prior art**. После глубокого изучения (см. lit-review запись):

- **Метрики:** 39.5k★, 4.5k forks, 288 releases, последний релиз 2026-05-16. Это не proof of concept, а зрелый продукт.
- **16 MCP tools** (`query`, `context`, `impact`, `detect_changes`, `rename`, `cypher`, `group_*`) + 2 prompts + 7 auto-discoverable resources.
- **Архитектура:** 12-фазный DAG-конвейер (scan → parse → cross-file → MRO → communities → processes), LadybugDB как графовый бэкенд, FTS + 384D embeddings.
- **16 поддерживаемых языков** через unified `LanguageProvider` interface.
- **Confidence scoring** на рёбрах (0.95 / 0.9 / 0.5 / fallback).
- **Интеграция с агентами:** Claude Code (full: 4 skills + Pre/PostToolUse hooks), Cursor (full), Codex/Windsurf/OpenCode (MCP only).
- **License:** PolyForm Noncommercial 1.0.0 — open source, но коммерческие агенты использовать не могут.

**Покрытие наших use cases:** 12 из 20 GitNexus решает напрямую через tools, ещё несколько — через `cypher` escape hatch.

GitNexus **уже реализовал** функциональность, которую мы изначально планировали стандартизировать в ASP. Это **переопределяет позиционирование трека** (см. § 8 ниже и [ADR 0001](../decisions/0001-mcp-extension-vs-new-protocol.md)).

**[agentic-codebase](https://github.com/agentralabs/agentic-codebase)** — semantic code intelligence для AI agents с impact analysis, coupling detection, prophecy. Меньший масштаб, но в том же пространстве. Дополнительный сигнал, что эта область активно осваивается.

**Implications:**

- Engineering работу по «code-aware MCP сервер» делать не нужно — она сделана.
- Gap, который остался, — **открытая спецификация** API, который GitNexus реализует de facto. Это меняет scope трека (см. § 8).

---

## 5. Open-source агенты: retrieval-pipelines

### 5.1 Aider

[github.com/Aider-AI/aider](https://github.com/aider-ai/aider). Python, CLI-первый, прозрачная архитектура.

**RepoMap** — ключевая фича Aider: tree-sitter-powered ranked symbol graph, обновляемый локально. По обзорам — даёт «intelligent context without loading entire files».

**Известные ограничения** (из GitHub issues):

- [#4113](https://github.com/Aider-AI/aider/issues/4113) — context management деградирует при долгих сессиях.
- [#1540](https://github.com/Aider-AI/aider/issues/1540) — пользователи запрашивают возможность подключать external context retrieval через HTTP/API.

Второй issue — прямой запрос на стандартизированный context-provider протокол, что укрепляет мотивацию ASP.

### 5.2 Continue.dev

[github.com/continuedev/continue](https://github.com/continuedev/continue). VS Code расширение, JS/TS.

**Retrieval:** Local vector DB через Lancet protocol для semantic search. Бенчмарки показывают 25% accuracy advantage над Cline на architectural questions, но есть проблемы — «codebase indexer sometimes fails to list the most important files».

### 5.3 Cline

[github.com/cline/cline](https://github.com/cline/cline). VS Code extension, TypeScript.

**Известные ограничения:**

- [#4389](https://github.com/cline/cline/issues/4389) — критическая проблема с большими файлами: hardcoded 300KB limits, нет chunked reading, нет recovery механизмов на `prompt too long` ошибках.

### 5.4 Общие паттерны

| Агент | Retrieval | Сильные стороны | Слабые стороны |
|---|---|---|---|
| Aider | RepoMap (tree-sitter graph) | Прозрачность, низкие требования | Долгие сессии деградируют |
| Continue | Vector DB (Lancet) | Semantic search | Индексер пропускает важные файлы |
| Cline | LLM-driven, file reads | Гибкость | Hardcoded limits, нет recovery |

Каждый делает retrieval по-своему. **Никто не делает это «правильно»** — каждый имеет известные пробелы. Это пространство, где стандартизация может дать реальный выигрыш.

---

## 6. Академические работы

### 6.1 SWE-bench и follow-ups

[SWE-bench Lite](https://github.com/princeton-nlp/SWE-bench) — 300 задач из 12 Python-репозиториев, средний размер 3000+ файлов на проект. Текущие top-результаты на Lite — 43% (general), 62% на Verified (CodeStory Midwit + swe-search).

**SWE-Search (ICLR 2025)** — описывает «Consolidation Gap»: «agents access most or all relevant code during their trajectory but only retain 50–70% of this evidence in their final context». То есть агенты **видят** релевантный код, но не используют его на patch generation.

Это критическое наблюдение для ASP-дизайна: ответы должны быть **structured так**, чтобы агенту было сложно потерять ключевую информацию при context management.

### 6.2 Прочие релевантные работы

**[Git Context Controller (arXiv:2508.00031)](https://arxiv.org/abs/2508.00031)** — управление контекстом LLM-агентов «как git». Прямая параллель с нашими целями composability и control.

**SWE-Adept** — фокус на deep codebase analysis для structured issue resolution. Подтверждает важность structured representations.

**[Lita (arXiv:2509.25873)](https://arxiv.org/abs/2509.25873)** — light agent для agentic coding. Минимальный набор операций — образец того, какой может быть «core API».

**[SWE-Bench Pro (arXiv:2509.16941)](https://arxiv.org/abs/2509.16941)** — более сложный benchmark, чем Lite, расширяющий evaluation для ASP-future.

**[SWE-ContextBench](https://www.emergentmind.com/topics/swe-context-bench)** — расширение SWE-bench Lite с 99 задачами, требующими dependency graph traversal. Прямо измеряет то, что ASP должен улучшить.

Эти работы нужно проработать детально в `lit-review/` на следующих итерациях.

---

## 7. Gap analysis

### 7.1 Что отсутствует в существующем стеке

1. **Типизированные code-specific primitives.**
   - LSP — есть, но editor-centric (position-based).
   - MCP — есть resources/tools, но без code-specific семантики.
   - Code knowledge graphs (GitNexus, agentic-codebase) — есть, но через MCP tools без типизации.

2. **Composability как структурная фича.**
   - LSP — атомарные запросы.
   - MCP — атомарные tools.
   - Open-source агенты — каждый делает свою композицию, ad-hoc.

3. **Cost-awareness для ответов.**
   - LSP — нет.
   - MCP — частично (ModelPreferences для sampling), но не для response budgets.

4. **Стандартизированная semantic API.**
   - SCIP/LSIF — индексные форматы, не протокол общения.
   - Stack Graphs — алгоритм, не интерфейс.

### 7.2 Что НЕ является gap

- **Transport.** JSON-RPC 2.0 + stdio решён давно.
- **Lifecycle.** LSP/MCP-стиль работает.
- **Capability negotiation.** MCP уже умеет.
- **Pagination, progress, cancellation.** MCP покрывает.
- **Multi-language parsing.** tree-sitter решает.
- **Name resolution.** Stack Graphs / LSP-серверы решают.

### 7.3 Adoption gap

Даже если технически делать ASP легко (потому что транспорт готов), есть **organizational** gap:

- Никто не координирует усилия across агентов.
- Нет шеринга code intelligence — каждый агент платит за свой индекс.
- Закрытые агенты (Cursor, Claude Code, Windsurf) не вкладываются в open standards.

ASP может частично решить это, но **технического решения недостаточно** — нужна стратегия адопшна.

---

## 8. Proposed approach: ASP как open RFC, formalizing GitNexus-style API

**Решение зафиксировано в [ADR 0001](../decisions/0001-mcp-extension-vs-new-protocol.md).** Эта секция объясняет why.

### 8.1 Переопределение задачи после анализа GitNexus

Изначальная гипотеза была: «ASP — typed code capability over MCP, расширяющий MCP стандартизированными code-specific операциями». После глубокого изучения GitNexus (§ 4.3) обнаружилось, что **этот функционал уже реализован**: 16 MCP tools покрывают большую часть наших use cases, активно используются Claude Code / Cursor / Codex / Windsurf / OpenCode, поддерживают 16 языков.

Engineering работу делать не нужно. Что осталось — **формализация**:

- GitNexus tools = de facto standard, но без формальной спецификации.
- Нет test suite для проверки совместимости.
- Нет capability discovery: агент не знает заранее, какие операции поддерживает сервер.
- Нет версионирования API для эволюции без breaking changes.
- **Главное:** license GitNexus (PolyForm Noncommercial) — закрывает коммерческое использование. Индустрии нужна открытая альтернатива.

### 8.2 Что такое ASP в этой постановке

**ASP — открытая RFC-спецификация набора MCP capabilities для code intelligence**, основанная на анализе существующих implementations (GitNexus как primary reference, agentic-codebase / Aider RepoMap / Continue indexer как secondary).

**Концептуальная аналогия:**

| Слой | Что делает | Реализации |
|---|---|---|
| MCP | Transport, lifecycle, generic capabilities | Anthropic SDK, ecosystem |
| **ASP (это мы)** | Code intelligence capability specification | GitNexus, наш reference, future implementations |
| Application | Конкретные code-MCP-серверы | Akon Labs, in-house solutions |

### 8.3 Что ASP включает

1. **Спецификация ~10–15 typed operations** на основе анализа GitNexus tools и наших use cases. Примеры (предварительно, для Фазы 1):
   - `code/findSymbol`, `code/findReferences`, `code/context`
   - `code/dependencies`, `code/impact`, `code/rename`
   - `code/detectChanges`, `code/query` (hybrid search), `code/generateMap`
2. **JSON Schema** для каждой операции (request + response).
3. **Capability negotiation** — какие из стандартных операций сервер поддерживает.
4. **Cost awareness** — `tokenBudget` параметр + `truncated` флаг в ответах. Это **дополнение** к GitNexus.
5. **Test suite** — компатибельность-тесты, которые любой сервер может прогнать.
6. **Reference implementation** — минимальная, не конкурирующая с GitNexus (например, через простой tree-sitter + SQLite).
7. **Open license** — Apache 2.0 / CC0 на спецификацию и тесты.

### 8.4 Что ASP НЕ делает

- **Не строит свой transport / lifecycle** — наследует от MCP полностью.
- **Не конкурирует с GitNexus** — наоборот, GitNexus может объявить compliance с ASP, и его tool API становится открытым стандартом de jure (если автор согласится).
- **Не покрывает все edge-cases языков** — GitNexus решает это лучше; ASP описывает интерфейс, реализация — за серверами.
- **Не вводит новые протокольные элементы за пределами MCP** — capability negotiation, content types, pagination, cancellation — всё из MCP.

### 8.5 Adoption strategy

Логичный порядок outreach:

1. **GitNexus / Abhigyan Patwari / Akon Labs** — primary target. Предложить участие в RFC, объявить compliance.
2. **agentic-codebase, Aider RepoMap, Continue indexer** — secondary implementations для разнообразия.
3. **Anthropic MCP сообщество** — RFC как proposal или discussion в MCP-каналах.
4. **Закрытые агенты (Cursor, Claude Code, Windsurf)** — после Anthropic, через MCP Foundation channels.

---

## 9. Threats to validity

### 9.1 GitNexus не примет участие в стандартизации

Если автор GitNexus не заинтересован — RFC может остаться без отношения к производству, и спецификация станет «академической». **Mitigation:** outreach на ранней стадии. Если откажутся — переориентация на secondary implementations (agentic-codebase, Aider RepoMap) как primary reference.

### 9.2 MCP может эволюционировать сам

Если Anthropic / AAIF добавят code-specific primitives в core MCP — наша спецификация становится избыточной. **Mitigation:** контакт с MCP working groups в Linux Foundation; ASP как natural follow-up к base MCP вместо competing initiative.

### 9.3 Низкая академическая новизна

«Формализация существующего» — менее яркий research contribution, чем «новый протокол». Это сужает venue: больше workshop-ы и SE-конференции, меньше PLDI/POPL. **Mitigation:** искать дополнительную contribution в анализе (например, formal semantics операций, capability negotiation patterns, benchmarking framework).

### 9.4 RFC drift от actual implementations

Если ASP-спецификация формально красивая, но не следит за реальной эволюцией GitNexus / других серверов — она становится «бумажным стандартом». **Mitigation:** living spec + версионирование с CI-проверкой совместимости с reference implementations.

### 9.5 Adoption барьер для коммерческих агентов

Главная мотивация ASP — открытая альтернатива noncommercial GitNexus. Но если коммерческие агенты предпочтут платную лицензию GitNexus или собственные in-house решения — open spec не получит критической массы. **Mitigation:** получить **3 экспериментальных пользователя** из open-source и close coordination с MCP Foundation.

### 9.6 GitNexus может выпустить свой стандарт

Akon Labs могут сами формализовать API под open license — что технически решает gap, но без участия сообщества. **Mitigation:** быстрая публикация RFC; если опередят — присоединение к их инициативе остаётся опцией.

---

## 10. Conclusion

### 10.1 Резюме

Анализ протоколов (LSP, MCP), foundations (tree-sitter, Stack Graphs, SCIP), open-source агентов (Aider, Continue, Cline), code knowledge graphs (GitNexus, agentic-codebase) и академических работ (SWE-Search, Git Context Controller, MCP Tool Descriptions Are Smelly) показывает:

- **Транспортная инфраструктура** для агент-codebase общения уже существует.
- **Code intelligence foundations** доступны как open-source.
- **Семантические primitives** для агента — отсутствуют как стандартизированная сущность.
- **20 use cases** подтверждают потребность в типизации и composability.

### 10.2 ADR 0001 закрыта

[ADR 0001](../decisions/0001-mcp-extension-vs-new-protocol.md) принята со статусом **accepted**:

**ASP позиционируется как открытая RFC-спецификация, формализующая GitNexus-style MCP-based code intelligence API как открытый стандарт.**

Это не «typed code capability over MCP» (изначальная формулировка), а более узкая и эмпирически обоснованная задача: формализация уже работающего de facto API в открытую спецификацию для других реализаций.

Изменение направления вызвано глубоким разбором GitNexus (§ 4.3), который показал, что engineering уже сделана, а gap — в открытости спецификации и lock-in в noncommercial license.

### 10.3 Следующие шаги (для Gate 0 → 1 closure)

1. **Глубокий разбор GitNexus tool schemas** — точные JSON forms, edge cases. Чтение `packages/mcp-server/src/` напрямую.
2. **arXiv-триаж**: 5–7 работ из списка § 6 в `lit-review/` (для достижения ≥10 ключевых работ).
3. **Lit-review записи** для agentic-codebase, Aider RepoMap.
4. **Outreach Abhigyan Patwari (GitNexus)** и 2 других экспериментальных пользователя.
5. **Gate 0 → 1 review** — checklist в `tracks/02-asp/README.md`.
6. **Постановка Фазы 1** — design-document для структуры спецификации.

### 10.4 Открытые вопросы для следующих фаз

- Уровень детализации typed primitives — где граница «достаточно общий / достаточно специфичный».
- Механизм composability — batched vs query language.
- Versioning стратегия — сильный contract от старта или эволюция через RFC.
- Адопшн-стратегия — какой агент первым адаптирует, как договариваться с закрытыми проектами.

Эти вопросы — для Фазы 1 (Дизайн), не для этого обзора.

---

## Источники

### Lit-review записи в репозитории

- [`microsoft-2022-lsp-spec.md`](../lit-review/microsoft-2022-lsp-spec.md) — LSP 3.17 specification.
- [`anthropic-2024-mcp-spec.md`](../lit-review/anthropic-2024-mcp-spec.md) — MCP specification.
- [`brunsfeld-2018-tree-sitter.md`](../lit-review/brunsfeld-2018-tree-sitter.md) — Tree-sitter.

### Прямые ссылки (требуют детального ревью на след. итерациях)

- [GitNexus — MCP-native knowledge graph](https://www.marktechpost.com/2026/04/24/meet-gitnexus-an-open-source-mcp-native-knowledge-graph-engine-that-gives-claude-code-and-cursor-full-codebase-structural-awareness/) — **prior art, critical**.
- [agentic-codebase — semantic code intelligence](https://github.com/agentralabs/agentic-codebase) — **prior art, critical**.
- [Aider RepoMap](https://github.com/Aider-AI/aider) — существующее решение в open source.
- [Continue codebase indexer](https://docs.continue.dev/guides/codebase-documentation-awareness) — существующее решение.
- [Stack Graphs (GitHub)](https://github.com/github/stack-graphs) — foundation для name resolution.
- [SCIP / LSIF (Sourcegraph)](https://github.com/sourcegraph/scip) — code index формат.

### Академические работы

- arXiv:2508.00031 — Git Context Controller.
- ICLR 2025 — SWE-Search (Consolidation Gap).
- arXiv:2509.25873 — Lita.
- arXiv:2509.16941 — SWE-Bench Pro.
- arXiv:2603.01327 — SWE-Adept.
- arXiv:2602.14878 — MCP Tool Descriptions Are Smelly.
- arXiv:2504.03767 — MCP Safety Audit.

### GitHub issues (источники pain points)

- Aider #4113 — context management degradation.
- Aider #1540 — external context retrieval request.
- Cline #4389 — large file handling failures.

### Внутренние артефакты

- [`02-use-cases.md`](02-use-cases.md) — 20 use cases с feasibility matrix.
- [`0001-mcp-extension-vs-new-protocol.md`](../decisions/0001-mcp-extension-vs-new-protocol.md) — открытая ADR для закрытия.
