# Model Context Protocol (MCP) Specification

## Metadata

- **Authors:** David Soria Parra, Justin Spahr-Summers (Anthropic). С декабря 2025 — Agentic AI Foundation (Linux Foundation).
- **Year:** Ноябрь 2024 (создание), 2025-11-25 (актуальная schema)
- **Venue:** Открытая спецификация, modelcontextprotocol.io
- **arXiv / DOI:** —
- **Link:** <https://modelcontextprotocol.io> | <https://github.com/modelcontextprotocol/modelcontextprotocol>
- **Citation key:** anthropic-2024-mcp
- **Дата прочтения:** 2026-05-21
- **Relevance (1–5):** 5
- **Tags:** mcp, protocol, design, primary-source, must-read, agent-integration

## TL;DR

MCP — открытый протокол для интеграции LLM-агентов с внешними источниками данных и инструментами. Использует JSON-RPC 2.0 поверх stdio / SSE / HTTP, явно вдохновлён LSP в дизайне message-flow. Архитектура host (приложение) ↔ client (per-server instance) ↔ server (предоставляет capabilities). Создан Anthropic в ноябре 2024, к декабрю 2025 принят OpenAI / Microsoft / Google / Cloudflare, передан в Agentic AI Foundation.

## Key claims

- **Проблема (N×M):** «Before MCP, developers often had to build custom connectors for each data source or tool, resulting in what Anthropic described as an "N×M" data integration problem».
- **Дизайн-наследие LSP:** «MCP re-uses the message-flow ideas of the Language Server Protocol (LSP) and is transported over JSON-RPC 2.0».
- **Архитектура трёх ролей:** Host (агент-приложение), Client (одна инстанс на сервер), Server (предоставляет capabilities).
- **Capability negotiation как у LSP:** при инициализации client и server обмениваются capabilities; есть и dynamic capabilities (`elicitation`, `tasks`, `sampling`).
- **Принятие:** «Adopted by major FM providers such as OpenAI, Microsoft, Google, and Cloudflare, and currently observes over 20 million weekly downloads» для Python/JS SDK.
- **Версионирование схемы по дате:** актуальная — `2025-11-25`. Schema определена в TypeScript, плюс JSON Schema для интеропа.

## Methodology

Не исследовательская работа, а спецификация плюс открытый процесс развития:

1. TypeScript-схема как single source of truth → генерация JSON Schema, документации.
2. Открытые SDK для Python, JS/TS, Java, Kotlin, C#, Swift.
3. Reference servers для популярных источников (filesystem, GitHub, Postgres, Slack).
4. Эволюция через RFC-стиль PR в `modelcontextprotocol/modelcontextprotocol`.

## Что MCP даёт (релевантное для ASP)

### Core primitives

| Primitive | Что это | Релевантность для code-agent |
|---|---|---|
| **Resources** | Read-only данные с URI (файлы, БД-строки, API). `resources/list`, `resources/read`, `resources/subscribe`. | Прямой fit для файлов кода. Subscribe = LSP didChange. |
| **Tools** | Callable функции с side-effects. `tools/call` с типизированными args. Hints: `readOnlyHint`, `destructiveHint`, `idempotentHint`. | Можно завернуть code-specific operations как tools (`find_references`, `impact_analysis`). |
| **Prompts** | Параметризованные шаблоны сообщений. | Меньше релевантно для нашего сценария. |
| **Sampling** | `sampling/createMessage` — запрос генерации у host. `ModelPreferences` — стоимость/скорость/intellect. | Может быть нужно для cross-agent сценариев. |
| **Roots** | Accessible directories/files. `roots/list`. | Аналог workspace-folders в LSP — то, на чём работаем. |
| **Tasks** | Async operations (`tasks/list/get/result/cancel`) со статусами и TTL. | Критично для индексации больших репо. |
| **Completion** | Autocomplete параметров. | Может пригодиться для запросов «дополни имя функции». |
| **Elicitation** | Запрос данных у пользователя (форма / URL). | Меньше релевантно. |

### Полезные инфраструктурные элементы

- **Pagination** — cursor-based для больших результатов (важно для code search).
- **Progress notifications** — через `progressToken` (LSP-стиль).
- **Cancellation** — `notifications/cancelled`.
- **Annotations** — метаданные `audience`, `priority`, `lastModified`. Можно использовать для пометки «это core API» / «это test code».
- **Content types** — Text/Image/Audio/ToolUse/ToolResult/ResourceLink/EmbeddedResource. Расширяемо.

## Gap (для нашего трека)

MCP — отличный **общий** протокол context exchange. Для code-agent сценариев у него три уровня gap:

### 1. Нет code-specific семантики first-class

MCP оперирует абстрактными resources и tools. Code-agent нужны:

- **Symbols** (функция, класс, метод, поле) как тип данных.
- **References** (где используется этот символ).
- **Type hierarchy** (что наследует, что наследуется).
- **Call graph** (кто вызывает, кого вызывает).
- **Diagnostics** с привязкой к коду.

В MCP всё это придётся:
- Либо завернуть в tools — но тогда каждый сервер придумывает свою сигнатуру (`find_references` vs `references` vs `xrefs`).
- Либо описать как resources с URI-схемой — но MCP резервирует URI под адресацию контента, не под семантические запросы.

### 2. Нет composability на уровне запросов

Tools в MCP вызываются по одному. Если агенту нужно «найти определение → найти ссылки → собрать с контекстом», это N последовательных вызовов с накоплением latency и потерей атомарности.

Возможные решения внутри MCP: композитные tools (`find_references_with_context`), batched API. Но это soft conventions, не структурная фича.

### 3. Token / cost awareness ограниченное

MCP имеет `ModelPreferences` (cost/speed/intelligence) для sampling. Но для **ответов** агенту нет общего token budget: tool может вернуть мегабайт текста, и протокол это не нормирует.

Для code-agent это критично — context window — конечный ресурс.

## Возможные пути для ASP

1. **MCP-extension через capability**: новый capability `code` с типизированными операциями (`code/findReferences`, `code/impactAnalysis`). Транспорт MCP, lifecycle MCP, ecosystem MCP.
2. **MCP server с code-specific tools**: «толстый» сервер, выставляющий все code-операции как tools. Работает сегодня с любым MCP host. Cons: тулы слабо типизированы, агенты должны их discover.
3. **Отдельный протокол ASP**: своя schema, свой ecosystem. Cons: zero adoption на старте.
4. **Гибрид**: ASP как формальная спецификация code-capability, реализуемая как набор «стандартных» MCP tools с фиксированными именами и сигнатурами.

ADR 0001 откладывается до сбора use cases.

## Open questions

- Есть ли уже **попытки code-extension** к MCP в open source? (нужно искать по GitHub и в issues `modelcontextprotocol/modelcontextprotocol`).
- Каким образом текущие code-MCP-серверы (GitHub MCP, filesystem MCP) обходят отсутствие code semantics? (Скорее всего — простой grep + AST.)
- Какие из 9 наших абстракций ТЗ (Semantic Slice, Dependency Query, Impact Analysis, etc.) **естественно** ложатся на MCP tools, а какие требуют новых сообщений?
- Что говорит сообщество MCP про «overload tools vs. typed primitives»?

## Related work cited

- LSP — прямой источник дизайна MCP, ключевая референсная работа.
- Agentic AI Foundation (Linux Foundation) — куда MCP перешёл, политика governance.
- arxiv:2504.03767 «MCP Safety Audit» — критика безопасности дизайна, нужно прочитать.
- arXiv:2602.14878 «MCP Tool Descriptions Are Smelly!» — критика качества tool descriptions, релевантно для нашего вопроса о composability.

## Личные заметки

**Ключевой инсайт:** MCP — это «context bus», LSP — «code-specific RPC». ASP лежит **между ними**: нужны code-specific семантические операции (как LSP), но в архитектуре, дружелюбной к LLM-агентам (как MCP — с tasks, cost-awareness, content types).

Самая вероятная архитектура ASP — **typed code capability поверх MCP**. То есть не «новый протокол», а формальная спецификация набора code-операций с фиксированными именами, сигнатурами и семантикой, которую MCP-серверы могут реализовать. Это:

- Сохраняет ecosystem MCP (SDK, transport, host integrations).
- Даёт типизацию и composability там, где сейчас «придумай свой tool».
- Open question: как формализовать composability — через batched requests / batched tools / отдельную capability `code/batch`.

Это **гипотеза**, не решение. Подтвердить или опровергнуть по итогам:

1. Изучения open-source агентов и их retrieval-логики.
2. Сбора 15–20 use cases.
3. Анализа: сколько из них покрывается composable MCP tools vs требует новых primitives.
