# exp-002 — SWE-bench baseline (preparation)

- **Статус:** preparation (PREREG draft, not yet tagged).
- **PREREG:** [PREREG.md](PREREG.md).

## Простыми словами

Это **скелет** будущего большого эксперимента: «делает ли наш сервер `asp-ref` AI-помощника лучше при решении настоящих задач с GitHub?». Сам прогон требует Docker, LLM API budget и ~30 часов вычислений — мы пока готовимся, но не запускаем.

## Что в этой папке

| Файл | Назначение |
|---|---|
| `PREREG.md` | План эксперимента, фиксируется git tag-ом перед запуском |
| `scripts/` | Скрипты прогона + агрегации (TODO) |
| `results/` | Сырые и обработанные данные (после прогона) |

## TODO до запуска

См. секцию «Что делается до launch» в [PREREG.md](PREREG.md#что-делается-до-launch-todo). Главное:

1. Docker image для `asp-ref`.
2. Скрипты прогона single trial.
3. Cline base config с timeouts.
4. Smoke test на n=5 задач.
5. **Pre-registration ритуал** — git tag.

## Что НЕ запускаем сейчас

Полный прогон (300 tasks × 2 conditions × 2 runs = 1200 trials, ~$600 cost, ~30 wall-clock hours) требует:

- ANTHROPIC_API_KEY с достаточным budget.
- Docker-capable runner (наш текущий sandbox его не имеет полноценно).
- Время на supervised execution.

Эти condition будут собраны в отдельной сессии — Gate 2 → 3 или 3 → 4 trigger.

## Связанные артефакты

- [SWE-bench лит-обзор](../../lit-review/jimenez-2023-swebench.md) — описание dataset.
- [ADR 0002](../../decisions/0002-asp-scope-opensource-agent-ecosystem-only.md) — почему Cline как тестовый агент.
- [Outreach plan](../../deliverables/outreach-draft.md) — параллельный трек.
