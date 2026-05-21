# 0001. MCP extension vs new protocol

- **Дата:** 2026-05-21 (создан как stub)
- **Статус:** proposed
- **Связанные ADR:** —

## Context

ТЗ Трека 2 предусматривает два пути:

1. **Расширение MCP (Model Context Protocol)** — добавить code-специфичные capabilities в существующий протокол Anthropic, опираясь на его транспорт, аутентификацию, экосистему серверов.
2. **Отдельный протокол ASP (Agent Server Protocol)** — построить с нуля, специально спроектированный под потребности агентов (semantic slicing, dependency queries, impact analysis, causal error chains).

Это решение — обязательное условие [Gate 0 → 1](../README.md#gate-0--1). До его принятия имеет смысл только литобзор и сбор use cases.

Силы:

- **За расширение MCP:**
  - Готовая экосистема серверов и SDK.
  - Уже принят несколькими агентами.
  - Низкий барьер для adoption.
- **Против расширения MCP:**
  - MCP спроектирован под обобщённый context, не под code-specific operations.
  - Может оказаться, что нужные абстракции (Semantic Slice, Impact Analysis) не ложатся в MCP-модель.
  - Версионирование и breaking changes координируются с Anthropic.

- **За отдельный протокол:**
  - Полная свобода дизайна.
  - Можно оптимизировать под cost-awareness, streaming, идемпотентность.
- **Против отдельного протокола:**
  - Нулевая экосистема на старте.
  - N×M-проблема, которую как раз должны решить.
  - Конкуренция с MCP вместо синергии.

## Decision

**TBD.** Решение откладывается до завершения литобзора (Фаза 0) и анализа реальных use cases. Конкретно — нужны ответы на вопросы:

1. Какие абстракции из списка ТЗ (Semantic Slice, Dependency Query, Impact Analysis, Causal Error Chain, Test-Code Mapping, Change-Aware Context) **естественно** ложатся на MCP-модель, а какие — нет?
2. Что говорят авторы открытых агентов (Aider, Continue, Cline) о текущих ограничениях MCP?
3. Есть ли уже попытки расширения MCP для code в open source?

## Consequences

(будут заполнены после принятия решения)

## Alternatives considered

(подробное сравнение — после литобзора)

## References

- ТЗ: `docs/TZ/RD_PROGRAM_TZ.md`, секция «ТРЕК 2, Фаза 0».
- MCP spec: modelcontextprotocol.io (ожидает обработки в `lit-review/`).
- LSP spec: microsoft.github.io/language-server-protocol (ожидает обработки в `lit-review/`).
