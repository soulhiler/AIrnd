# AIrnd — R&D Program: AI-Native Programming Stack

Исследовательская программа, изучающая неосвоенные стыки в цепочке «язык → компилятор → железо» с появлением LLM как нового звена, плюс **методология самой такой работы** (как делать R&D с AI-помощником, не уходя в перепроизводство).

**Метрика успеха:** публикация (arXiv → workshop → конференция) и воспроизводимый артефакт. Не продукт, не выручка.

## Текущее состояние

| Параметр | Значение |
|---|---|
| Главный трек | **Трек 4 — Методология AI-assisted R&D** (вышел на первое место после ретроспективы трека 2) |
| Текущая фаза трека 4 | Фаза 0 — Подготовка (литобзор + первичный анализ) |
| Старт трека 4 | 2026-05-22 |
| Трек 2 (ASP) | **⏸ ПАУЗА** до второго и третьего внешнего отзыва (правило «one feature, one outreach» из трека 4) |

## Структура программы

- **Трек 1: Intent-Preserving IR** — sidecar-аннотации от LLM для компилятора (отложен).
- **Трек 2: [Agent Server Protocol (ASP)](tracks/02-asp/)** — стандартизация общения LLM-агентов с кодовой базой. ⏸ на паузе.
- **Трек 3: Verifiable Code Zones** — LLM-синтез контрактов + SMT-верификация (отложен).
- **Трек 4: [Методология AI-assisted R&D](tracks/04-methodology/)** — как сдерживать переусложнение в R&D с AI-помощником. Активный.

Полное ТЗ: [`docs/TZ/RD_PROGRAM_TZ.md`](docs/TZ/RD_PROGRAM_TZ.md). Трек 4 — внеплановое дополнение к ТЗ, обоснование в [ADR 0001 трека 4](tracks/04-methodology/decisions/0001-track-4-scope-methodology-of-aiassisted-research-and-development.md).

## Навигация

| Раздел | Что внутри |
|---|---|
| [`docs/TZ/`](docs/TZ/) | ТЗ программы под версионированием |
| [`docs/workflows/`](docs/workflows/) | Протоколы работы: литобзор, журнал, ADR, pre-reg |
| [`tracks/02-asp/`](tracks/02-asp/) | Артефакты Трека 2 (на паузе) |
| [`tracks/04-methodology/`](tracks/04-methodology/) | Артефакты Трека 4 (главный сейчас) |
| `tools/` | Скрипты для создания записей |
| `Makefile` | Унифицированные команды |

## Быстрый старт

```bash
make help                              # список команд
make notebook                          # запись в лабораторный журнал на сегодня
make lit-add SLUG=lsp-spec             # новая запись литобзора
make adr-new TITLE="Use SQLite"        # новая ADR
make phase-status                      # чеклист текущей фазы
make lint                              # markdown lint + link check
```

## Принципы

1. **Pre-registration** перед каждым экспериментом (через git commit с тегом).
2. **Negative results публикуются** — это тоже научный вклад.
3. **Gate-критерии явные** — переход между фазами только после чеклиста.
4. **Open science by default** — код, данные, решения публичны.
5. **Claude Code = имплементационный партнёр**, не научный руководитель.
6. **5 правил против overcoding** (из трека 4, см. `CLAUDE.md`):
   - Code budget ≤500 строк за сессию.
   - One feature, one outreach.
   - Adversarial test required для security-sensitive файлов.
   - Stage gates как hard barriers (≥1 внешний пользователь).
   - Lit-review в параллель, не одним проходом.

## Лицензия

См. [`LICENSE`](LICENSE).
