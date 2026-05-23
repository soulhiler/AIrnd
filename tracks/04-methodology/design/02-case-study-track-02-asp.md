# 02. Case study: трек 2 (ASP) как пример overcoding

- **Статус:** draft v0.1 (2026-05-23)
- **Период покрытия:** 2026-05-21 (Phase 0 старт) — 2026-05-22 (Round 2 audit + v0.1.2).
- **Связано:** [ADR 0001 трека 4](../decisions/0001-track-4-scope-methodology-of-aiassisted-research-and-development.md), [01-problem-statement.md](01-problem-statement.md).

## Простыми словами

Это разбор того, как наш собственный трек 2 (стандарт ASP) за пару дней вырос из «небольшой программы-примера» до полноценного продукта на ~3500 строк. Мы фиксируем что произошло, какие метрики были, где сломалось, что внешний читатель нашёл — чтобы потом, когда будем формулировать принципы, у нас были **реальные числа**, а не общие слова.

Это **первичные данные** для трека 4. Не отчёт о треке 2, а **изучение** трека 2 как объекта.

## Timeline

| Дата / момент | Что произошло | Артефакты |
|---|---|---|
| 2026-05-21 утром | Старт трека 2. Lit-review (4 работы: LSP, MCP, tree-sitter, GitNexus) | 4 lit-review entries, ADR 0001 stub |
| Тот же день днём | Литобзор расширен (Aider, Continue, Cline, Goose, SCIP, SWE-bench) | 10/10 lit-review, Gate 0 → 1 closed |
| Тот же вечер | Phase 1 запущена, написана спека v0.1 ~1500 строк | `design/03-asp-spec-draft.md`, 5 ADR |
| 2026-05-21 ночь | Phase 2 запущена, scaffold + первые операции | `prototype/` с базовой структурой, 4 операции работают |
| 2026-05-22 | Stage 2a part 2-3: FTS5 + findByTag + context + refresh | 7 операций, schema v1 |
| 2026-05-22 | Stage 2b: embeddings + retrieve + 23 теста | 8 операций, schema v2, dependencies +2 |
| 2026-05-22 | Stage 2c: impact + writeFile + applyPatch + LLM rerank | 12 операций, schema v3-4, dependencies +1 |
| 2026-05-22 | Делаем «всё за раз»: tree-sitter coverage 4 → 12 языков, async refresh, persistent jobs | 58 тестов, 9 ADR |
| 2026-05-22 | Outreach: статья + integration + smoke test | `deliverables/article-for-engineers.md` |
| 2026-05-22 | Alex round 1 audit → 5 findings, hardening v0.1.1 | ADR 0010, 53 теста |
| 2026-05-22 | Alex round 2 audit → 6 findings (2 серьёзных), v0.1.2 | 58 тестов, 10 ADR |

**Всего: ~24 часа реальной работы AI (распределённой по сессиям) → 3500 строк, 10 ADR, 11 lit-review, 58 тестов, 12 операций, 12 языков, 9 зависимостей.**

## Числа

### Объёмы

| Метрика | Значение |
|---|---|
| Сумма строк TS в `prototype/src/` | ~3500 |
| Сумма строк тестов | ~1200 |
| Файлов в `src/` | 21 |
| ADR | 10 (трек 2) + 1 (трек 4) |
| Lit-review записи | 11 |
| Спецификация | ~1500 строк |
| Зависимости npm | 7 (`@modelcontextprotocol/sdk`, `zod`, `better-sqlite3`, `@types/better-sqlite3`, `tree-sitter-wasms`, `web-tree-sitter`, `@xenova/transformers`, `@anthropic-ai/sdk`) |
| Версии схемы БД | 4 (v1 → v4 за два дня) |

### Темп

| Что | Сколько |
|---|---|
| Phase 0 (lit-review) | Закрыта за **1 день** при плане 3-4 недели — 21× быстрее ТЗ |
| Phase 1 (design) | Закрыта за **<1 дня** при плане 4 недели |
| Phase 2 (prototype) | 12 операций реализованы за **~1.5 дня** |
| Время между ADR | Среднее ~2 часа |
| LOC per session (последняя сессия v0.1.2) | +350 строк |
| LOC per session (пиковая) | +800 строк (Stage 2c) |

### Внешний аудит (Alex)

| Раунд | Время audit | Findings | TFEB (от релиза) |
|---|---|---|---|
| Round 1 | ~1 час | 5 (1 critical + 3 high + 1 info) | ~30 минут после первого outreach |
| Round 2 | ~30 минут | 6 (1 HIGH + 1 MEDIUM + 4 LOW/INFO) | ~10 минут после v0.1.1 |

### Качество артефактов (на момент v0.1.1, до Round 2 fixes)

| Аспект | Состояние |
|---|---|
| ADR-vs-code consistency | **Расхождение** в ADR 0010 §1 (dryRun gate в коде vs ADR) — поймано Round 2 |
| Adversarial test coverage | **Низкое**: тесты писались с позиции «как пользоваться правильно», не «как сломать». Round 2 PoC tests (3 штуки) показали реальные дыры |
| Lit-review coverage | **С пропусками**: Atalay's «The Harness Problem» (relevance 5/5) пропущен в одноразовом прохождении lit-review, найден через outreach |
| Документация vs реализация | INTEGRATION.md «trusted HF cache» — корнер-катит wording, Round 2 указал |

## Что внутри происходило (механика)

### Паттерн «делай все»

В transcript'е сессии 8 раз встречается команда пользователя «делай все» (или эквивалент: «делай оба», «делай оба варианта»). Каждый раз AI добавлял 2-4 крупные подсистемы:

| «делай все» | Что добавилось |
|---|---|
| #1 | Phase 0 → Phase 1: spec v0.1 skeleton + ADR 0006 (TypeScript) |
| #2 | Section 9 + Section B + ADR 0007/0008 |
| #3 | scaffold + 2 операции |
| #4 | SQLite FTS5 indexer |
| #5 | findByTag + context + refresh |
| #6 | tree-sitter + incremental |
| #7 | embeddings + retrieve + 23 теста |
| #8 | impact + mutations + ADR 0009 |
| #9 | расширение языков + async + LLM rerank |
| #10 | follow-ups + outreach + SWE-bench scaffold |

**Каждое «делай все» вернуло код в среднем по ~350-800 строк**. Никакого паузы между ними, никакого «давай посмотрим, что получилось».

### Самокритика автора и её слепые зоны

В сессии было **два** явных critical-analysis запроса от пользователя:

1. **Round 1 self-critique** — после первого outreach. AI признал: edge resolution приближённый, нет evaluation, scope drift, dogfood не активирован. **Security гимн не упомянул.**
2. **Round 2 self-critique** — после Alex round 2. AI признал: тесты writeFile тестировали «правильное использование», не атаку.

В обоих случаях self-critique **пропустил** security-баги, которые Alex находил за минуты.

**Структурная причина:** автор кода (даже если это AI) видит код в контексте «как пользоваться», не «как сломать». Adversarial position требует **внешнего** человека с отдельной мотивацией (academic curiosity, paid pentest, или просто чужой проект).

### ADR-vs-code расхождения

Прямой пример из case study:

```text
ADR 0010 §1 (написано в первой половине сессии):
  «Исключение: asp_applyPatch({dryRun: true}) тоже gated — единообразие
   политики важнее лёгкого UX для dryRun.»

apply-patch.ts:78 (написано в той же сессии, 1 час спустя):
  if (!mutationsEnabled() && !dryRun) {
    throw new MutationsDisabledError(
      "asp_applyPatch is disabled. Use dryRun=true to validate without writing."
    );
  }
```

ADR говорит «dryRun gated», код реализует «dryRun bypass + advertised как workaround». Это **не баг кода**, а **баг процесса** — решение записано, потом написан код, противоречащий записанному решению.

Это **типичный** результат `V_gen ≫ V_val`: автор не успевает перечитать собственный ADR перед написанием кода.

## Что хорошее тоже было

Объективно — не всё провалилось:

| Что | Почему хорошо |
|---|---|
| Спецификация ASP v0.1 (1500 строк) | Реальный artifact для outreach. Полная, с capability negotiation, error codes, JSON Schemas. |
| 5 fixes vs GitNexus | 2 из 5 (offline FTS + explicit degradation) — настоящие, реализованные, измеримые улучшения. |
| Outreach сработал | После 1 запроса получили substantial security review. Это **выше базового rate** для cold outreach. |
| Тесты как regression net | Когда мутация gate сломала 13 тестов — это **поймало** проблему до commit. |
| Документированный процесс | ADR + notebook + lit-review дают полный аудит-трейл. Без этого case study был бы невозможен. |

**То есть проблема не «всё плохо», а «слишком быстро + без сдерживания»**. Сами артефакты — рабочие. Беда — в темпе и отсутствии валидации между этапами.

## Уроки для трека 4

### Что подтверждает гипотезу H1 (V_gen ≫ V_val)

1. **Темп Phase 0/1/2 = 21-30× быстрее ТЗ.** Не потому что мы лучше, а потому что AI-помощник не имеет естественного тормоза.
2. **TFEB порядка минут.** Внешний читатель находит дыры **до** того, как мы успеваем их валидировать сами.
3. **ADR-vs-code расхождения** — прямой признак того, что author не успевает перечитывать собственные решения.

### Что предлагает решение

1. **Code budget работал бы.** Из ~3500 строк по нашему анализу нужно ~1400. 60% — overproduction.
2. **One feature, one outreach работал бы.** Между Alex round 1 и round 2 мы продолжили добавлять (security fixes), не получив второго пользователя. Round 2 нашёл больше, чем нужно было.
3. **Adversarial tests работали бы.** Alex's PoC tests (3 штуки) — это то, что мы должны были написать **сами** при добавлении readFile + writeFile + applyPatch.

### Что неизвестно

- Сколько LOC overhead'а компенсируется за счёт того, что AI **дешевле** генерирует, чем человек? Если LOC «стоит» в 10× меньше, может быть, оверкодинг не такой страшный?
- Какой минимальный объём adversarial testing достаточен? 1 тест на каждый security-sensitive файл? Больше?
- Outreach rate-limit — сколько фич можно safely добавить между раундами outreach? 1? 3? Это эмпирически нужно мерить.

## Следующие шаги для case study

- **Дополнительные кейсы.** Когда трек 1 (Intent-Preserving IR) активируется, его метрики собираются параллельно. Тогда у нас будет 2 кейса для сравнения.
- **Сравнение с non-AI разработкой.** Если у нас или у Alex'а есть проект, написанный без AI-помощника — можно сравнить метрики (LOC, TFEB, ADR-vs-code consistency).
- **Quantitative analysis when literature is available.** После lit-review мы сможем сравнить наши числа с теоретическими предсказаниями (например, MTBF model для software).

## Open questions для исследования

1. Является ли V_gen ≫ V_val действительно **причиной** overcoding, или это **симптом** более глубокой причины (отсутствие культуры code review, отсутствие шкуры в игре, и т.д.)?
2. Если применить трек-2-метрики **к самому треку 4** (рекурсивная проверка), увидим ли мы overcoding и здесь? Если да — это либо bug нашего подхода, либо feature (значит overcoding неизбежен без structural fix).
3. Можно ли формализовать «structural fix» через measureable что-то, или это всегда останется art / discipline?

## References

- Все ADR трека 2 ([`tracks/02-asp/decisions/`](../../02-asp/decisions/)) — primary data.
- Notebook трека 2 ([`tracks/02-asp/notebook/`](../../02-asp/notebook/)) — timeline источник.
- Outreach drafts ([`tracks/02-asp/deliverables/outreach-draft.md`](../../02-asp/deliverables/outreach-draft.md)) — внешняя валидация.
- Alex's audit transcript (whatsapp chat 2026-05-22) — внешние findings.
