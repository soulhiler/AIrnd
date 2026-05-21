# 0001. ASP — open RFC, formalizing GitNexus-style code intelligence MCP API

- **Дата:** 2026-05-21 (stub) → 2026-05-21 (закрытие)
- **Статус:** accepted
- **Связанные ADR:** —
- **Pre-decision review:** [`design/01-literature-review.md`](../design/01-literature-review.md), [`design/02-use-cases.md`](../design/02-use-cases.md), [`lit-review/patwari-2026-gitnexus.md`](../lit-review/patwari-2026-gitnexus.md)

## Context

ТЗ Трека 2 ставил вопрос: «расширение MCP или отдельный протокол ASP». До литобзора эта дилемма выглядела бинарной. После литобзора (Фаза 0) обнаружилось третье измерение:

**GitNexus (39.5k★, 16 MCP tools, активная разработка, deep Claude Code integration, license PolyForm Noncommercial)** — уже реализовал `de facto` ту самую функциональность, которую мы планировали стандартизировать. Покрывает 12 из 20 наших use cases напрямую через MCP tools. Аналогичные проекты (agentic-codebase, Aider RepoMap) — менее зрелые, но в том же пространстве.

Таким образом, **сам протокол уже существует** в виде набора ad-hoc MCP tools. Чего нет:

- **Открытой спецификации**, которую могут реализовать конкуренты (включая коммерческие агенты).
- **Test suite**, на котором можно проверить совместимость.
- **Capability discovery**, позволяющего агенту обнаружить, какие из стандартных операций поддерживает данный сервер.
- **Версионирования**, позволяющего эволюционировать API без breaking changes.

License `PolyForm Noncommercial 1.0.0` у GitNexus — это **главный gap для индустрии**. Commercial-агенты (Cursor, Claude Code как продукт, Windsurf) не могут commit'иться к GitNexus без коммерческого соглашения. Им нужна открытая альтернатива или открытая спецификация, под которую можно построить in-house или partner implementation.

## Decision

**ASP (Agent Server Protocol) позиционируется как открытая RFC-спецификация, формализующая GitNexus-style MCP-based code intelligence API как открытый стандарт.**

Конкретно:

1. **ASP не строит свой transport / lifecycle** — наследует от MCP полностью.
2. **ASP стандартизирует набор typed code operations** — на основе GitNexus's 16 tools + дополнения, выявленные на use cases analysis.
3. **ASP определяет capability negotiation** для code-specific MCP-серверов — какой сервер какие операции поддерживает.
4. **ASP включает test suite** — любой сервер может прогнать тесты и заявить compliance.
5. **ASP остаётся открытой спецификацией** под permissive license (Apache 2 / CC0), специально чтобы коммерческие агенты могли её реализовать.

## Consequences

### Positive

- **Конкретный scope:** не «выдумать протокол с нуля», а «извлечь стандарт из существующих implementations». Это резко сокращает риск дизайна-в-вакууме.
- **Validation built-in:** GitNexus покрывает 12/20 use cases — это уже эмпирический proof of concept для большой части спецификации.
- **Adoption strategy:** есть конкретный target — авторы GitNexus и коммерческие агенты. Outreach понятен.
- **Контрибуция чёткая:** спецификация + test suite + reference implementation (минимальная, не конкурирующая с GitNexus).
- **Снижение N×M:** если несколько серверов (GitNexus, наш reference, third-party) реализуют ASP — агенты получают portability.

### Negative

- **Зависимость от существующего:** если GitNexus меняет API, нам нужно обновлять спецификацию. Это нормально для RFC, но добавляет maintenance.
- **Меньшая академическая новизна:** «формализация существующего» — менее яркий research contribution, чем «новый протокол». Это сужает venue: больше workshop-ы и SE-конференции, меньше PLDI/POPL.
- **Coordination overhead:** работа с авторами GitNexus, с MCP-сообществом, с агентами — много диалога, мало кода.
- **GitNexus может игнорировать:** если автор не заинтересован в формализации — спецификация может остаться без отношения к производству.

### Necessary follow-ups

- **Глубокое изучение GitNexus tool schemas** — JSON, описания, edge cases. Прочитать `packages/mcp-server/src/` напрямую.
- **Контакт с Abhigyan Patwari / Akon Labs** — узнать про их планы стандартизации, готовность участвовать в RFC.
- **Поиск других реализаций** — Continue's @codebase, Aider's RepoMap, agentic-codebase — есть ли пересечения операций.
- **Outreach 3 экспериментальных пользователя** — авторы Aider, Continue, или известный code-MCP проект (требование Gate 0 → 1).
- **Постановка Фазы 1** — design-document со структурой спецификации.

## Alternatives considered

### Alternative B: Capability negotiation protocol layer

Определить только capability discovery протокол, не специфицируя конкретные операции.

**Почему отклонено:** слишком абстрактно. Без конкретных типизированных операций capability negotiation не решает реальную проблему агента — он всё равно должен учить tool descriptions каждого сервера. Решает только подмножество gap.

### Alternative C: Закрыть трек

GitNexus покрывает 80% задачи, перейти к Треку 1 или 3.

**Почему отклонено:**

- Несмотря на покрытие use cases, license gap (noncommercial) — реальная проблема для индустрии.
- Spec contribution — отдельная ценность, отличная от implementation.
- Текущая работа (lit-review, use cases) уже инвестирована; перепрофилирование контрибуции — дешевле, чем переключение трека.
- Окно момента: MCP только что (декабрь 2025) перешёл в Linux Foundation; стандартизация code-MCP-API — natural follow-up, есть политическое окно.

### Alternative D: Специализация в подобласти

Найти узкий niche, где GitNexus не работает (например, verification-aware code intelligence — пересечение с Треком 3).

**Почему отклонено:** specialization можно оставить как **этап 2** трека после выпуска RFC v1.0. Базовый стандарт нужен в любом случае.

### Alternative E: Контрибуция в GitNexus как community contributor

Не делать спецификацию, а добавлять features в GitNexus.

**Почему отклонено:** не решает license gap. И не даёт research contribution для публикации.

### Изначальная Alternative «расширение MCP vs отдельный протокол»

Эта дилемма **переформулирована**. ASP — это **ни расширение MCP**, **ни отдельный протокол**. ASP — **открытая спецификация набора code-specific MCP capabilities**, которую может реализовать любой MCP-сервер. Никакого MCP-extension в смысле модификации core MCP не требуется.

## References

- [`lit-review/microsoft-2022-lsp-spec.md`](../lit-review/microsoft-2022-lsp-spec.md)
- [`lit-review/anthropic-2024-mcp-spec.md`](../lit-review/anthropic-2024-mcp-spec.md)
- [`lit-review/brunsfeld-2018-tree-sitter.md`](../lit-review/brunsfeld-2018-tree-sitter.md)
- [`lit-review/patwari-2026-gitnexus.md`](../lit-review/patwari-2026-gitnexus.md) — **критическая prior art**.
- [`design/01-literature-review.md`](../design/01-literature-review.md) — сводный обзор.
- [`design/02-use-cases.md`](../design/02-use-cases.md) — 20 use cases.
- ТЗ: `docs/TZ/RD_PROGRAM_TZ.md`, секция «ТРЕК 2».
- GitNexus: <https://github.com/abhigyanpatwari/GitNexus>.
