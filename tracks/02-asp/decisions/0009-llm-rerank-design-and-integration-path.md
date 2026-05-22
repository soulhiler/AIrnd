# 0009. LLM rerank — design and integration path

- **Дата:** 2026-05-22
- **Статус:** proposed
- **Связанные ADR:** [0001](0001-mcp-extension-vs-new-protocol.md), [0002](0002-asp-scope-opensource-agent-ecosystem-only.md), [0007](0007-storage-backend-stage-2a-sqlite-with-fts5.md)

## Простыми словами

В `asp/retrieve` есть параметр `rerank: true`. Сейчас он возвращает «честную» пометку — «эта фича не реализована, результаты ранжированы только первой стадией». Этот ADR описывает, **как** мы реализуем настоящий rerank в будущем — то есть **LLM смотрит на топ-50 кандидатов и переупорядочивает их по полезности для запроса**.

Главный вопрос — **где живёт LLM**:

1. **Сервер вызывает LLM сам** (через API ключ). Просто, но усложняет деплой и связывает наш OSS с одним вендором.
2. **Сервер просит клиента сделать вызов** через MCP sampling. Чище, но требует поддержки sampling в клиенте (Cline / Goose могут пока не поддерживать).

Решение **отложено** — мы хотим сначала собрать обратную связь от OSS-агентов (Gate 1 → 2 outreach), какой путь им удобнее.

## Context

В ADR 0007 и spec Section 6.3.2 двух-стадийный retrieval pattern (Continue.dev-style) включает опциональный rerank stage:

```text
query
  → Stage 1 (vector / keyword / hybrid) → nRetrieve кандидатов
  → Stage 2 (LLM rerank, опциональный) → nFinal кандидатов
```

Continue.dev делает rerank default-on с использованием их сконфигурированной LLM. Это **дорого** (LLM-вызов на каждый запрос) и связывает retrieval с конкретным LLM-инстансом.

Stage 2b нашей reference impl реализует Stage 1 полностью (vector + keyword + hybrid через RRF). Stage 2 — заглушка с degradation entry:

```json
{
  "feature": "rerank",
  "reason": "LLM-based rerank is not implemented in Stage 2b",
  "impact": "Results are ordered by first-stage ranking only",
  "severity": "info"
}
```

Сейчас принимаем решение про **архитектуру** rerank, но **не имплементируем** его. Решение архитектурное — затрагивает spec (как client запросит rerank?) и наш `asp-ref` (как ему делать LLM-вызов?).

## Decision

**Имплементация LLM rerank откладывается до Stage 2b polish или Stage 2c.** Pre-commitment к архитектуре делаем сейчас, реальная имплементация — после Gate 1 → 2 outreach (получим feedback от OSS-агентов).

**Предпочтительный путь:**

1. **MCP sampling primary.** Если client advertise `sampling` capability (per MCP spec), `asp-ref` использует `sampling/createMessage` для rerank. Плюсы:
   - Один LLM на сессию — тот же, что использует агент. Никаких отдельных API ключей.
   - OSS-friendly: не диктуем вендора.
   - В соответствии с философией ADR 0002 (open-source agent ecosystem).
2. **Direct LLM SDK fallback.** Если sampling недоступен И конфигурация задаёт API-ключ:
   - `ASP_RERANK_PROVIDER=anthropic` + `ANTHROPIC_API_KEY` — через `@anthropic-ai/sdk`.
   - `ASP_RERANK_PROVIDER=openai` + `OPENAI_API_KEY` — через `openai`.
   - `ASP_RERANK_PROVIDER=ollama` + `OLLAMA_HOST` — локально (offline-friendly).
3. **Disabled (default).** Если ни sampling, ни конфигурация — `rerank: true` возвращает текущую degradation entry. Server **не** падает, просто не делает rerank.

**Capability negotiation в spec v0.2:**

```jsonc
{
  "rerank": {
    "available": true,
    "providers": ["sampling", "ollama"]
  }
}
```

**Промпт rerank** (черновик):

```text
You are reranking code-intelligence search results.
Query: {query}
Candidates (one per line, JSON: {id, snippet, tags}):
{candidates}

Return the top {nFinal} candidate IDs in order of relevance to the query,
one per line. No prose, no explanation.
```

## Consequences

### Positive

- **Чёткий план** — не оставляем «LLM rerank» как абстрактный TODO. Конкретные провайдеры, API surface, fallback chain.
- **OSS-aligned.** MCP sampling — первый класс. Direct LLM — fallback, не блокирующий.
- **Configurability через env vars** — не лезем в YAML / config files на этом этапе.

### Negative

- **MCP sampling adoption неравномерный.** Cline (TS) поддерживает; Goose (Rust) — TBD; Continue (TS) — TBD. До outreach мы не знаем, насколько реалистично работать через sampling.
- **Direct LLM == vendor coupling.** Anthropic / OpenAI / Ollama — каждый свой SDK. Зависимостей у `asp-ref` становится больше.
- **Rerank — дорогое удовольствие.** На каждый retrieve с rerank=true — LLM-вызов. Latency 1-5 секунд, cost cents. Не подходит для interactive agent workflow без кэширования.

### Necessary follow-ups

- **Outreach feedback** — спросить Cline / Goose / Aider maintainerов: «вы будете использовать sampling, direct LLM, или disabled?».
- **Cache strategy** — TBD. Опции: per-query LRU, persistent (по rerank input hash), вообще без кеша.
- **Spec update v0.2** — добавить `rerank` capability как объект (current capability — boolean).
- **Когда имплементируем:** новый ADR с финальным выбором.

## Alternatives considered

### Alternative A: Implement direct LLM (Anthropic SDK) now

Отклонено: преждевременная имплементация без feedback от OSS-агент сообщества; vendor lock-in до того, как мы поняли клиентский профиль.

### Alternative B: Implement MCP sampling first only

Отклонено как single path: requires sampling support в клиенте; мы не контролируем что Cline / Goose делают. Оставляем direct LLM как fallback.

### Alternative C: Skip rerank entirely

Trust first-stage ranking полностью. Отклонено: rerank — реальная ценность для категорийных запросов в Continue's experience.

### Alternative D: Heuristic rerank без LLM

Бустить по простым сигналам — недавний mtime, exact-match overlap в tags. Pros: бесплатно. Cons: не дает того семантического понимания, для которого rerank существует. Может быть **дополнительным** боостом, но не заменой LLM-rerank.

## References

- Spec Section 6.3.2 — `asp/retrieve` API including `rerank` parameter.
- [Continue.dev lit-review](../lit-review/continuedev-2026-codebase-indexing.md) — original two-stage retrieval pattern with default-on rerank.
- [MCP spec](../lit-review/anthropic-2024-mcp-spec.md) — sampling capability.
- [ADR 0002](0002-asp-scope-opensource-agent-ecosystem-only.md) — OSS-only scope informs vendor preferences.
