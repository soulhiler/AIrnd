# Language Server Protocol 3.17 Specification

## Metadata

- **Authors:** Microsoft (с участием Red Hat и Codenvy при стандартизации)
- **Year:** 2016 (initial), 3.17 опубликована 2022-05-10
- **Venue:** Официальная спецификация, microsoft.github.io
- **arXiv / DOI:** —
- **Link:** <https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/>
- **Citation key:** microsoft-2022-lsp-3-17
- **Дата прочтения:** 2026-05-21
- **Relevance (1–5):** 5
- **Tags:** lsp, protocol, design, primary-source, must-read

## TL;DR

LSP — стандартизированный протокол на JSON-RPC 2.0 поверх stdio/socket, через который редакторы кода общаются с language servers. Решает M×N проблему (M редакторов × N языков), сводя её к M+N: каждый редактор реализует LSP-клиент один раз, каждый язык — LSP-сервер один раз. Версия 3.17 (2022) — текущая стабильная, добавила type hierarchies, inline values, inlay hints и notebook document support.

## Key claims

- **Проблема:** «Без LSP интеграция M редакторов с N языками требует M×N реализаций» — основной motivating problem (§ Introduction).
- **Архитектура:** «The lifecycle of a server is managed by the client (e.g. a tool like VS Code or Emacs)» — клиент управляет жизненным циклом сервера (§ Server lifecycle).
- **Транспорт:** JSON-RPC 2.0 поверх stdio (most common), sockets, named pipes, node IPC. Формат сообщения: HTTP-подобный header (`Content-Length`) + content в UTF-8.
- **Три типа сообщений:** RequestMessage (требует ответа), NotificationMessage (event-like, без ответа), ResponseMessage (результат или ошибка).
- **Capability negotiation:** «Not every language server can support all features defined by the protocol. LSP therefore provides "capabilities"» (§ Capabilities). Согласование возможностей в initialize, плюс dynamic registration через `client/registerCapability`.
- **Предшественник:** TypeScript Server protocol — тоже stdin/stdout с JSON payload. LSP — обобщение этого подхода до language-neutral.

## Methodology

Это спецификация, не исследование. Метод изложения:

1. Описание Base Protocol (форматы сообщений).
2. Lifecycle (initialize → initialized → работа → shutdown → exit).
3. Capability negotiation.
4. Конкретные операции по категориям (Text Document Sync, Language Features, Workspace, Window).
5. Версионирование через `@since` аннотации.

Эволюция протокола — через PR против markdown-документа в gh-pages branch репозитория `microsoft/language-server-protocol`.

## Gap (для нашего трека)

LSP — отличный референс для дизайна протокола, но **спроектирован под редактор, не под агента**. Конкретные ограничения, релевантные для ASP:

1. **Position-centric, не semantic.** Большинство операций принимают `TextDocumentPositionParams` (uri + line + character). Агенту нужна семантика: «все вызовы функции X», «модуль, где определена эта абстракция». Это можно построить поверх LSP, но требует N+1 вызовов.
2. **Нет дедупликации / семантического слайсинга.** `textDocument/references` возвращает плоский список локаций. Агенту нужны дедуплицированные, контекстуализированные срезы.
3. **Нет cost-awareness / token budgets.** LSP не знает про токены — ответы могут быть произвольно большими. Для LLM-агента это проблема: каждый лишний токен стоит денег и съедает context window.
4. **Streaming ограниченный.** Progress reporting есть, но не для основных payload-ответов. Большие результаты приходят целиком.
5. **Нет impact analysis.** «Что сломается, если я изменю X» — операция, которая нужна агенту, но не предусмотрена.
6. **Нет causal error chains.** Diagnostics — плоский список. Связи «ошибка A вызвала ошибку B» нет.
7. **Stateful per-document model.** Сервер хранит состояние документа в памяти, синхронизируется через didChange. Агент работает с repo-level snapshots — другая модель.
8. **Composability ограниченная.** Каждый request атомарен. Если агенту нужно «найти определение → найти все ссылки → вернуть с контекстом ±10 строк», это три отдельных запроса.

Потенциальный contribution ASP:

- Семантические primitives (semantic slice, dependency query, impact analysis) как first-class operations.
- Cost-aware ответы с token budgets.
- Композируемые запросы (batched / pipelined).
- Snapshot-based модель вместо stream-of-edits.

## Open questions

- Какие капабилити LSP **уже** покрывают use cases агентов на 80%, и где остаются 20% gap?
- Можно ли реализовать ASP как LSP-extension (через capability registration), не строя новый протокол?
- Как сообщество LSP относится к code-agent use cases? Есть ли issues / discussions на эту тему?
- Какие edge cases в lifecycle (например, server crash, concurrent clients) релевантны для агентов?

## Related work cited

Изучить дальше:

- **TypeScript Server protocol** — предшественник LSP, может пролить свет на дизайн-решения.
- **DAP (Debug Adapter Protocol)** — родственный протокол от той же команды Microsoft, может быть образцом расширения для агентов.
- **BSP (Build Server Protocol)** — параллельный протокол для систем сборки, тоже основан на LSP-style JSON-RPC.

## Личные заметки

Ключевое наблюдение: LSP решает **синхронизацию состояния** (документ в редакторе ↔ модель в сервере) с **точечными запросами** (что в этой позиции?). Агенту нужно **снимок состояния** (вся кодовая база на момент T) с **семантическими запросами** (что эта функция делает, где её используют, что от неё зависит).

Это разные парадигмы. Возможно, ASP — это не «улучшенный LSP», а **другой протокол с похожим транспортом**. Решение откладывается до анализа MCP и use cases.
