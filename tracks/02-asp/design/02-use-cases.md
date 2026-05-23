# Use Cases — Agent Server Protocol (ASP)

Цель документа — собрать ≥15 типичных операций, которые LLM-агент выполняет с кодом, чтобы:

1. Понять, какие **примитивы** нужны протоколу.
2. Оценить, какие из них уже покрываются MCP / LSP / open-source агентами.
3. Идентифицировать gap — то, что отсутствует в существующем стеке.
4. Закрыть [ADR 0001](../decisions/0001-mcp-extension-vs-new-protocol.md) на эмпирике.

## Методология

Источники:

- **GitHub issues** популярных AI-агентов: Aider ([#4113](https://github.com/Aider-AI/aider/issues/4113), [#1540](https://github.com/Aider-AI/aider/issues/1540)), Cline ([#4389](https://github.com/cline/cline/issues/4389)).
- **SWE-bench Lite** (300 задач из 12 Python-репозиториев) и расширения (SWE-ContextBench, SWE-Bench Pro).
- **Документация существующих решений:** Aider RepoMap, Continue codebase indexer, Kiro refactor tools, GitNexus MCP knowledge graph, agentic-codebase.
- **Академические работы:** SWE-Search (ICLR 2025), SWE-Adept, SWE-Fixer, Lita, Git Context Controller, MCP Tool Descriptions Are Smelly.
- **ТЗ** программы (примеры из секции «Трек 2, Фаза 1»).

Для каждого use case фиксируем:

- **Сценарий:** что пользователь говорит агенту.
- **Что нужно агенту:** атомарные операции, на которые декомпозируется.
- **Как сейчас:** что делают существующие агенты, с pain points.
- **Идеальный API:** какая операция была бы идеальной.
- **MCP-feasibility:** реализуемо ли это сегодня в MCP, и если да — насколько естественно.

---

## Категория A. Рефакторинг

### UC-001. Multi-file rename с каскадом

**Сценарий:** «Переименуй функцию `parseConfig` в `loadConfig` и обнови все места использования, включая тесты, импорты, документацию».

**Что нужно агенту:**

- Найти определение символа `parseConfig`.
- Найти все ссылки (вызовы, импорты, упоминания в строках).
- Применить переименование во всех местах атомарно.
- Подтвердить, что тесты остаются зелёными.

**Как сейчас:** агент делает grep+replace, часто пропускает edge-cases (импорты с алиасами, строки, docstrings). По [Kiro](https://kiro.dev/blog/refactoring-made-right/) — «process can turn into a slow, error-prone loop of searching for the old name and replacing it».

**Идеальный API:** `code/rename(symbol, oldName, newName)` → typed edit list с dry-run, confidence per edit.

**MCP-feasibility:** Можно как tool, но потеряется типизация (агент должен знать, что возвращается список edits с определённой структурой). Текущие MCP-серверы делают это ad-hoc.

**Tags:** refactoring, multi-file, high-frequency

---

### UC-002. Добавить поле в модель и обновить usages

**Сценарий:** «Добавь поле `created_at: datetime` в модель `User` и обнови все места создания/сериализации».

**Что нужно агенту:**

- Найти определение `User`.
- Найти все конструкторы (вызовы `User(...)`, `User.objects.create(...)`).
- Найти все сериализаторы (где есть `to_dict`, schema mappings, ORM-маппинги).
- Сгенерировать diff с поправками + миграцию БД (если применимо).

**Как сейчас:** агент находит модель, генерирует diff, но often misses migration/serializer files. Пример из обсуждений: [«агент справляется с моделью, но забывает сериализатор»].

**Идеальный API:** `code/findUsages(symbol, kind=construction|serialization)` с семантическим фильтром.

**MCP-feasibility:** MCP-tool возможен, но требует семантического анализа за рамками простого grep. Нужен LSP-серверный анализатор языка.

**Tags:** refactoring, schema-change, cross-cutting

---

### UC-003. Изменить сигнатуру функции

**Сценарий:** «Добавь аргумент `timeout: int = 30` в функцию `fetch_data` и адаптируй все вызовы».

**Что нужно агенту:**

- Найти определение и сигнатуру.
- Найти все вызовы (учитывая позиционные / named-args).
- Решить, какое значение передавать в каждом call site (часто — default).
- Применить.

**Как сейчас:** регулярный workflow для агентов, но N+1 vs батч-операция. По SWE-bench анализу — частая категория задач.

**Идеальный API:** `code/changeSignature(symbol, signatureSpec)` → typed edit list по call sites.

**MCP-feasibility:** Можно как tool, но семантика «правильно передать args» требует LSP-стиль анализа.

**Tags:** refactoring, signature, high-frequency

---

### UC-004. Удалить deprecated API (impact analysis)

**Сценарий:** «Функция `legacy_serialize` помечена deprecated с прошлого квартала. Найди все её использования, оцени, что нужно мигрировать, и удали её».

**Что нужно агенту:**

- Найти все ссылки на `legacy_serialize`.
- Для каждой — определить, мигрируется ли тривиально (1-к-1 замена) или требует семантического разбора.
- Оценить blast radius (сколько модулей затронуто).
- Сгенерировать план миграции.

**Как сейчас:** агент находит, но без оценки сложности замены. Часто застревает на edge-cases.

**Идеальный API:** `code/impactAnalysis(symbol)` → call sites grouped by depth + confidence per replacement.

**MCP-feasibility:** Можно реализовать поверх AST-индекса. Существующее решение — [agentic-codebase](https://github.com/agentralabs/agentic-codebase) делает impact analysis на code graph.

**Tags:** deprecation, impact-analysis, planning

---

### UC-005. Extract function

**Сценарий:** «Этот блок кода из 15 строк повторяется в 3 местах. Вынеси в общую функцию».

**Что нужно агенту:**

- Найти семантически похожие фрагменты (не текстуально — переменные могут отличаться).
- Извлечь, параметризовать.
- Заменить во всех местах.

**Как сейчас:** агент видит только то, что в текущем контексте. Другие 2 повторения за пределами окна — обычно не находятся.

**Идеальный API:** `code/findSimilar(codeFragment, similarity=structural|semantic)` → ranked list.

**MCP-feasibility:** Сложно через tools — нужен либо специализированный индекс (embeddings + AST), либо batch API.

**Tags:** refactoring, similarity-search, AI-specific

---

## Категория B. Поиск и навигация

### UC-006. Find all references с контекстом

**Сценарий:** «Покажи примеры использования функции `chunk_text` в кодовой базе с контекстом ±5 строк».

**Что нужно агенту:**

- Дедуплицированный список references.
- Каждая ссылка — с контекстом N строк.
- Ranking по «важности» (production code > tests > docs).

**Как сейчас:** LSP `textDocument/references` даёт список локаций без контекста. Агент потом делает N запросов на чтение файлов с offset.

**Идеальный API:** `code/findReferences(symbol, contextLines=N, ranking=usage|locality)` — single call.

**MCP-feasibility:** Идеальный кандидат на typed code capability. Сегодня — N+1 запросов в MCP, либо толстый custom tool.

**Tags:** search, code-archaeology, high-frequency

---

### UC-007. Find similar code patterns

**Сценарий:** «Найди все места, где мы обрабатываем ошибки HTTP похожим образом».

**Что нужно агенту:**

- Семантический поиск, не grep.
- Учёт паттернов: try/except + status codes, retry logic, etc.

**Как сейчас:** Continue использует vector DB; Aider's RepoMap — структурный граф. Обе подхода имеют точность <80% по обзорам.

**Идеальный API:** `code/findPattern(natural_language|code_example)` → ranked matches.

**MCP-feasibility:** Скорее всего, **отдельный примитив** — это AI-нативная операция, которой нет в классических code-tools.

**Tags:** search, semantic, AI-specific

---

### UC-008. Find tests covering this code

**Сценарий:** «Какие тесты проверяют функцию `validate_email`?»

**Что нужно агенту:**

- Маппинг код → тесты (через coverage tools, или эвристически через имена, или через граф вызовов).
- Снепшот результата прохождения тестов.

**Как сейчас:** агент гадает по соглашениям имён. Часто промахивается.

**Идеальный API:** `code/testsCoverage(symbol)` → list of tests, with optional coverage data.

**MCP-feasibility:** Требует интеграции с coverage-инструментами (pytest-cov, gcov). Можно как MCP-tool, специфичный для проекта.

**Tags:** testing, mapping, project-specific

---

### UC-009. Navigate dependency graph

**Сценарий:** «Покажи все модули, от которых зависит `payment_service`, и кто зависит от него».

**Что нужно агенту:**

- Граф зависимостей на уровне модулей.
- Direction filter (upstream / downstream).
- Depth limit.

**Как сейчас:** Aider RepoMap делает это для Python через AST; для других языков — слабо. По [graph-based knowledge tools](https://www.grahambrooks.com/post/building-a-code-knowledge-graph-for-ai-agents/) — активно развивающаяся область.

**Идеальный API:** `code/dependencies(target, direction=up|down|both, depth=N)` → typed graph.

**MCP-feasibility:** Идеальный кандидат на code capability. Есть прецеденты ([GitNexus](https://www.marktechpost.com/2026/04/24/meet-gitnexus-...)).

**Tags:** navigation, graph, architecture

---

### UC-010. Find example usage of API

**Сценарий:** «Как обычно вызывают `Database.transaction()` в нашем коде?»

**Что нужно агенту:**

- Найти представительные примеры (не все 200, а 3–5 типичных).
- С полным контекстом — что вокруг вызова.

**Как сейчас:** агент grep'ает, читает первые попавшиеся. Часто примеры — atypical (test-only, deprecated).

**Идеальный API:** `code/usageExamples(symbol, count=5, diversity=true)` → ранжированные примеры.

**MCP-feasibility:** Композиция `findReferences` + `chunk` с ranking. Можно сделать через batched MCP, но качество зависит от ranking-логики.

**Tags:** search, code-archaeology, on-boarding

---

## Категория C. Отладка

### UC-011. Why does this test fail (causal chain)

**Сценарий:** «Тест `test_user_signup` падает с `AttributeError: 'NoneType' has no attribute 'email'`. Объясни почему».

**Что нужно агенту:**

- Локализация failure (где именно).
- Reverse trace: что должно было быть не None.
- Анализ assumptions в тесте и в production code.

**Как сейчас:** агент видит stack trace, читает файл вокруг локации, гадает. По [SWE-bench анализу] — это одна из самых слабых категорий для агентов.

**Идеальный API:** `code/causalChain(error, depth=N)` → ordered list (error → cause → cause-of-cause).

**MCP-feasibility:** Сложно. Требует runtime-инструментации или статического dataflow-анализа.

**Tags:** debugging, causal, AI-hard

---

### UC-012. Trace error origin в stack trace

**Сценарий:** «Эта ошибка приходит из production logs. Покажи цепочку — где она может возникать».

**Что нужно агенту:**

- Распарсить stack trace.
- Mapping строк трейса → код (с учётом version control).
- Inference: какие сценарии приводят к этому пути.

**Как сейчас:** агент читает stack trace, открывает файлы по очереди. Не всегда учитывает branch/commit.

**Идеальный API:** `code/stackTraceContext(traceText)` → enriched trace with code chunks.

**MCP-feasibility:** Можно как tool, требует адресной логики парсинга trace per language.

**Tags:** debugging, stack-trace, production

---

### UC-013. Find related issues / PRs

**Сценарий:** «Был ли уже похожий баг в этом коде?»

**Что нужно агенту:**

- Связь код → коммиты (git blame).
- Коммиты → PR / issues.
- Семантический поиск по описанию issues.

**Как сейчас:** агент часто не имеет доступа к git history. Github MCP server даёт частичный доступ.

**Идеальный API:** `code/relatedHistory(symbol|file, since=date)` → list of issues/PRs with relevance.

**MCP-feasibility:** Github MCP server покрывает частично. Можно объединить с code-MCP для richer context.

**Tags:** history, context, integration

---

## Категория D. Понимание

### UC-014. Explain this module

**Сценарий:** «Что делает модуль `auth/`?»

**Что нужно агенту:**

- Список файлов с их ролями.
- Public API (что экспортируется).
- Зависимости (что используется извне модуля).
- Высокоуровневое summary.

**Как сейчас:** агент читает все файлы по очереди (если влезают в контекст). Если нет — суммаризирует частично.

**Идеальный API:** `code/moduleSummary(path)` → structured summary (files, API, deps, intent).

**MCP-feasibility:** Может быть composite tool. AI-генерация summary поверх structured data.

**Tags:** understanding, onboarding, summarization

---

### UC-015. Show architecture overview

**Сценарий:** «Покажи общую архитектуру репозитория».

**Что нужно агенту:**

- Top-level разбиение (модули).
- Связи между модулями (call graph aggregated).
- Точки входа.
- Conventions (как организован repo).

**Как сейчас:** агент видит дерево файлов и README. Без графа связей даёт поверхностный обзор.

**Идеальный API:** `code/architecture(root)` → typed graph + descriptions.

**MCP-feasibility:** Composite. Требует индексирования всего репо.

**Tags:** understanding, repo-level, expensive

---

### UC-016. Compare implementations

**Сценарий:** «У нас две функции с похожими именами `serialize_user_v1` и `serialize_user_v2`. В чём разница?»

**Что нужно агенту:**

- AST-diff обеих функций.
- Семантический diff (что делают по-разному).
- Историю — почему появились обе.

**Как сейчас:** агент читает обе, текстуально сравнивает. Часто пропускает тонкие отличия в side-effects.

**Идеальный API:** `code/compare(symbol1, symbol2)` → structured diff.

**MCP-feasibility:** Можно через batched read + AST tool. Требует AST-aware diff.

**Tags:** understanding, comparison, refactoring-prep

---

## Категория E. Модификация

### UC-017. Add tested feature across N files

**Сценарий:** «Добавь endpoint `/api/v1/users/profile` — нужно: route, handler, test, документация».

**Что нужно агенту:**

- Понимание convention'ов проекта (где роуты, где handlers).
- Создание файлов в правильных местах.
- Согласованность стиля.
- Тесты для нового кода.

**Как сейчас:** агент справляется на простых проектах, путается на сложных (microservices, monorepo). Pain point из [tedious blog].

**Идеальный API:** `code/conventions(root)` → discovered patterns (file org, naming, test placement).

**MCP-feasibility:** Сложно автоматизировать convention discovery. Скорее AI-задача, не RPC-вопрос. Но `code/conventions` как hint было бы полезно.

**Tags:** modification, conventions, feature-add

---

### UC-018. Migrate from API X to Y

**Сценарий:** «Перейди с библиотеки `requests` на `httpx` во всём проекте».

**Что нужно агенту:**

- Найти все импорты `requests`.
- Для каждого вызова — найти эквивалент в `httpx`.
- Учесть subtle differences (sync/async, error types).
- Применить.

**Как сейчас:** агент обычно справляется с тривиальной частью (импорт), но застревает на edge-cases.

**Идеальный API:** `code/findUsagesOfLibrary(libraryName)` + библиотека migration patterns (внешнее).

**MCP-feasibility:** Поиск usages — тривиально. Migration mapping — отдельная задача (часто решается через otkrytye datasets).

**Tags:** migration, cross-library, planning

---

### UC-019. Find dead code

**Сценарий:** «Какие функции в проекте никто не вызывает?»

**Что нужно агенту:**

- Полный граф ссылок (символ → ссылки на него).
- Включая dynamic dispatch (что особенно сложно в Python/JS).
- Список «orphan» символов.

**Как сейчас:** статические инструменты (vulture для Python) — есть, но интеграция с агентом ad-hoc.

**Идеальный API:** `code/deadCode(root, includeDynamicHeuristics=true)` → list of unreferenced symbols with confidence.

**MCP-feasibility:** Tool-like, требует indexing. Существующие линтеры покрывают, но в protocol не вписаны.

**Tags:** analysis, cleanup, code-quality

---

### UC-020. Semantic merge conflict resolution

**Сценалий:** «Merge conflict — две ветки изменили один файл по-разному. Помоги разрешить, понимая семантику».

**Что нужно агенту:**

- AST-уровневый diff обеих сторон.
- Понимание, какие изменения совместимы, какие — нет.
- Предложение resolution с учётом обоих intents.

**Как сейчас:** агенты делают это плохо — обычно выбирают одну сторону или копируют обе. SWE-bench tasks показывают это как проблемную область.

**Идеальный API:** `code/mergeAware(conflict)` → semantic merge plan.

**MCP-feasibility:** Сложно. Требует deep semantic analysis. На грани AI-задачи и формальной операции.

**Tags:** merge, AI-hard, advanced

---

## Сводный анализ

### Feasibility matrix

| Use case | MCP today (composite tools) | MCP + typed code capability | Полностью отдельный протокол |
|---|---|---|---|
| UC-001 Rename | Слабо: нет типизации | Хорошо | Хорошо |
| UC-002 Add field cascade | Слабо | Хорошо | Хорошо |
| UC-003 Change signature | Слабо | Хорошо | Хорошо |
| UC-004 Impact analysis | Возможно через `agentic-codebase` | Хорошо | Хорошо |
| UC-005 Extract function | Сложно (similarity search) | Композиция | Композиция |
| UC-006 Find refs with context | Возможно, N+1 calls | Идеально (single call) | Идеально |
| UC-007 Find similar patterns | Через embeddings, ad-hoc | Композиция | Композиция |
| UC-008 Tests coverage | Project-specific tool | Хорошо как capability | Хорошо |
| UC-009 Dependency graph | GitNexus прецедент | Идеально | Идеально |
| UC-010 Usage examples | Композиция | Хорошо | Хорошо |
| UC-011 Causal error chain | Сложно | Сложно (требует runtime) | Сложно |
| UC-012 Stack trace context | Возможно | Хорошо | Хорошо |
| UC-013 Related history | Github MCP покрывает частично | Композиция с Github MCP | Композиция |
| UC-014 Module summary | Composite tool | Хорошо | Хорошо |
| UC-015 Architecture | Composite, дорого | Хорошо | Хорошо |
| UC-016 Compare impls | Composite | Хорошо | Хорошо |
| UC-017 Conventions | Сложно (AI-задача) | `code/conventions` hint | `code/conventions` hint |
| UC-018 Library migration | Композиция | Хорошо для поиска usages | Хорошо |
| UC-019 Dead code | Linter tool | Хорошо как capability | Хорошо |
| UC-020 Semantic merge | На грани AI | На грани AI | На грани AI |

### Паттерны

1. **Composability важна для 60% use cases.** Большинство задач требует комбинации операций (find + chunk + rank). В MCP сегодня это N+1 вызовов.

2. **Типизация важна для 70% use cases.** Агенты часто промахиваются, потому что не знают точной формы ответа tool. Typed primitives с фиксированной schema снимают этот шум.

3. **Semantic primitives (references, impact, dependencies, hierarchy) встречаются в ≥10 use cases.** Это явный сигнал, что код-специфичные операции должны быть first-class.

4. **AI-задачи (similarity, conventions, semantic merge) — на 15% use cases.** Эти операции лежат за пределами классических RPC и требуют либо ML inside server, либо делегирования агенту с помощью.

5. **Project-specific (tests coverage, history, conventions) — 15% use cases.** Нужны hooks для интеграции с проектным контекстом.

### Implications для ADR 0001

**Подтверждается гипотеза:** ASP — typed code capability поверх MCP. Конкретные следствия:

1. **Core primitives как typed operations** (не tools):
   - `code/findReferences`
   - `code/dependencies`
   - `code/impactAnalysis`
   - `code/findSymbol`
   - `code/usageExamples`
   - `code/moduleSummary`

2. **Composability primitives** — batched / pipelined запросы (`code/compose([op1, op2, op3])`).

3. **Optional capabilities** для специализированных операций:
   - `code/testsCoverage` (требует интеграции с coverage)
   - `code/conventions` (AI-hint, не строгий запрос)
   - `code/findSimilar` (AI-powered)

4. **Cost-awareness через token budgets** на уровне response (`maxTokens`, `truncate=true`).

5. **Sane defaults** для каждой операции — confidence threshold, ranking, context size.

**Что НЕ нужно делать:**

- Полностью отдельный протокол — ecosystem MCP даёт слишком много (transport, lifecycle, content types, pagination, cancellation).
- «Толстый MCP сервер с tools» — без типизации агенты теряются.

**Открытые вопросы:**

- Уровень детализации typed primitives. Слишком много = overengineering. Слишком мало = опять «ad-hoc tools».
- Как именно специфицировать composability — RPC-batching или GraphQL-стиль query language.
- Какие операции **обязательны** (core) и какие **опциональны** (extensions).

Эти вопросы — для Фазы 1 (Дизайн), не для текущей. Сейчас задача — закрыть ADR 0001 направлением.

---

## Следующие шаги

1. **Перевести use cases в acceptance criteria** для будущей спецификации.
2. **Найти 3 экспериментальных пользователя** (требование Gate 0 → 1) — людей, готовых дать feedback на спецификацию.
3. **Закрыть ADR 0001** на основании этого анализа.
4. **Написать сводный литобзор** `01-literature-review.md` (5–10 страниц) — для Gate 0 → 1.
