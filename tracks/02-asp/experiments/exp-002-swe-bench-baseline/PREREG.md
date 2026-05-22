# exp-002 — SWE-bench baseline preregistration

- **Дата создания:** 2026-05-22
- **Статус:** draft (pre-registration, not yet committed via git tag)
- **Связанные:** [SWE-bench lit-review](../../lit-review/jimenez-2023-swebench.md), [Gate 3 → 4 criteria](../../README.md)

## Простыми словами

Мы хотим **измерить**, делает ли наш стандарт ASP + сервер `asp-ref` AI-помощников лучше при решении настоящих программистских задач. Этот документ — **план эксперимента, зафиксированный заранее** (pre-registration), чтобы потом нельзя было «подкрутить» условия под желаемый результат.

**Главный вопрос:** если дать AI-помощнику доступ к `asp-ref` через MCP — он решит **больше** реальных задач с GitHub, чем без него?

## Гипотезы

**H1 (primary):** Один и тот же LLM-агент, имеющий доступ к `asp-ref` через MCP, решит **≥10 процентных пунктов больше** задач из **SWE-bench Lite** (n=300), чем тот же агент без `asp-ref`. Метрика: % issues resolved (binary pass/fail per task).

**H2 (secondary):** Среди задач, требующих понимания связей между функциями (cross-file modifications), выигрыш `asp-ref` будет ≥15 п.п.

**H3 (latency):** Median wall-clock time per task с `asp-ref` будет в пределах ±20% от baseline. Цель — показать, что server overhead не убивает productivity.

**Null hypothesis (H0):** Разница в % issues resolved между treatment и baseline не достигает 95% confidence (binomial test).

## Условия эксперимента

### Agent

- **OSS-агент с MCP-support.** Кандидат №1: **Cline** (62k★, MCP-native). Backup: модифицированный SWE-agent baseline.
- **Модель LLM:** Claude Sonnet 4.6 (`claude-sonnet-4-6`) — оба условия используют одинаковый LLM, чтобы изолировать эффект `asp-ref`.

### Baseline condition

- Cline без `asp-ref`. Использует built-in tools: `read_file`, `list_files`, `search_files`, etc.
- Никакого pre-built индекса. On-demand reading.

### Treatment condition

- Cline + `asp-ref` mounted через `.cline/mcp.json`:

  ```json
  { "mcpServers": { "asp-ref": { "command": "npx", "args": ["asp-ref"] } } }
  ```

- Перед запуском задачи: `asp_refresh({scope: "full", embed: true})` для полной индексации с embeddings.
- На время задачи: 12 ASP операций доступны.

### Dataset

- **SWE-bench Lite** (n=300). Каждая задача — Docker image с pre-fix codebase + GitHub issue text + verification tests.
- **NOT** train data для модели (Sonnet 4.6 trained до этого dataset).

### Run protocol

1. Каждая задача запускается **независимо** в чистом Docker контейнере.
2. Time budget per task: **30 minutes wall-clock**, **$2 LLM API cost**. Halt при exceed.
3. Каждый condition прогоняется **дважды** (n=600 trials total) для variance estimation. Average over 2 runs.
4. Final patch validated by SWE-bench test suite (binary pass/fail).

### Metrics

**Primary:**

- `pass@1`: % tasks resolved on first run.
- `pass@avg`: avg pass rate across 2 runs.

**Secondary:**

- Median wall-clock time per task.
- Median LLM tokens per task.
- Median LLM cost per task.
- Distribution of `asp/*` operations called per task (which ASP capabilities did the agent actually use?).

**Diagnostic:**

- % tasks halted at time budget vs cost budget vs naturally completed.
- For each `asp/*` op: success rate, avg degradation entries returned.

## Stop conditions

- **Early success:** если treatment beats baseline на >15 п.п. в первой половине (n=150) с p<0.01 — можем остановиться раньше и опубликовать.
- **Early failure:** если treatment underperforms baseline в первой половине с p<0.01 — останавливаемся, анализируем, фиксируем lessons learned.
- **Cost overrun:** если total LLM cost превысит $1000 — pause and re-evaluate.

## Подсчёты

- 300 tasks × 2 conditions × 2 runs = 1200 trials.
- Avg cost per trial: ~$0.5 (conservative). Total: **$600**.
- Avg wall-clock per trial: 15 min. Sequential: 300 hours. Parallelized (10 concurrent): **30 hours**.

## Critical pre-commitments

**Lock-in (before data collection):**

1. **Этот файл** + git tag `prereg/exp-002-swe-bench-baseline/2026-XX-XX` (заменить дату при tagging).
2. Версия `asp-ref` тестирования: HEAD commit hash из ветки `main` в момент tag-а.
3. Версия Cline: latest stable release at tag time.
4. Версия Sonnet: `claude-sonnet-4-6` (frozen model ID; not "auto-latest").
5. SWE-bench Lite dataset: `princeton-nlp/SWE-bench_Lite` v1.0 commit hash на huggingface.

**Что можно менять после tag-а (amendments only):**

- Bug fixes в `asp-ref` если выявлены до начала data collection (re-tag).
- Никаких изменений в protocol, metrics, или stop conditions после tag-а.

## Что делается до launch (TODO)

- [ ] Docker image для `asp-ref` (npm install + build + ready-to-mount).
- [ ] Скрипт `scripts/run-trial.sh` — single task runner.
- [ ] Скрипт `scripts/aggregate.py` — собрать pass@1 / pass@avg.
- [ ] SWE-bench Lite data fetched.
- [ ] Cline base config with timeout / cost limit.
- [ ] Cost monitoring — Anthropic API usage dashboard.
- [ ] Dry-run на n=5 random tasks. Smoke test before full launch.

## Что НЕ делаем в этом эксперименте (отложено)

- **SWE-bench Verified (n=500)** — большой prestige boost, но дольше / дороже. Если Lite даёт сильный сигнал — переходим к Verified в exp-003.
- **Multilingual tasks** — SWE-bench is Python-only. Multilingual coverage — отдельный эксперимент.
- **Comparison с GitNexus** — мы намеренно сравниваем asp-ref vs no-server (baseline). Сравнение с GitNexus — отдельный экспериментальный вопрос (он PolyForm Noncommercial, нашему commercial-friendly scope не помеха).
- **Multi-agent (server shared между Cline + Aider)** — слишком сложно для первого эксперимента.

## Pre-registration ритуал

После заполнения этого файла и убеждения, что план финален:

```bash
git add tracks/02-asp/experiments/exp-002-swe-bench-baseline/PREREG.md
git commit -m "prereg(exp-002): SWE-bench Lite baseline + asp-ref treatment"
git tag prereg/exp-002-swe-bench-baseline/2026-XX-XX
git push origin main --tags
```

**После этого момента** никакие изменения в PREREG.md без явной пометки «amendment».
