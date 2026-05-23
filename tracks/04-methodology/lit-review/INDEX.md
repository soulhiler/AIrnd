# Литературный обзор — Трек 4 (Методология AI-assisted R&D)

Индекс работ. Каждый файл — одна работа. Обновляется автоматически через `make lit-add TRACK=04-methodology SLUG=...` или вручную.

## Must-read (Фаза 0)

Кандидаты к обработке (≥10 для закрытия Gate 0 → 1):

### Software engineering / общая методология

- [x] **Frederick Brooks** — «The Mythical Man-Month» (1975) + «No Silver Bullet» (1986) → [`brooks-1975-mythical-man-month.md`](brooks-1975-mythical-man-month.md)
- [ ] **John Gall** — «General Systemantics» (1975) — «сложная работающая система всегда эволюционирует из простой».
- [ ] **Larry Tesler** — Law of conservation of complexity — сложность не уничтожается, перераспределяется.
- [ ] **Mel Conway** — Conway's Law (1968) — структура организации = структура системы.
- [ ] **Dan McKinley** — «Choose Boring Technology» — почему выбирать скучное.
- [ ] **Lindy effect** — Talab + ранние работы.

### Теория надёжности машин и механизмов

- [x] **Семейство классических работ** (Дружинин, Орлов, MIL-HDBK-217, советская инженерная школа) → [`reliability-theory-classical-foundations.md`](reliability-theory-classical-foundations.md) — обобщённая запись по доступным источникам; конкретные первоисточники не достали через web (403).
- [ ] **MIL-HDBK-217** или эквивалент — расчёт надёжности комплексных систем (нужен полный текст).
- [ ] **Musa, Iannino, Okumoto** — «Software Reliability» (1987) — formal extension theory надёжности на software.
- [x] **В. Л. Аршинский, Л. В. Аршинский, С. В. Бахвалов** — «Принципы необходимости и достаточности в систематизации ПО» (2019) → [`arshinskiy-2019-software-systematization.md`](arshinskiy-2019-software-systematization.md) — полный текст получен через user upload, прочитан. Дают **формальный аппарат** (нотация `¬A → ¬B`, три аспекта e/f/g), не competing principle. Дополняют, не заменяют нашу триангуляцию.

### Lean / Continuous Improvement

- [ ] **Эрик Райс** — «Lean Startup» (2011) — validated learning, MVP, build-measure-learn.
- [ ] **Toyota Production System / Kaizen** — постепенные улучшения.

### TRIZ

- [x] **Г. С. Альтшуллер** — основы ТРИЗ, законы развития технических систем (S-curve, переусложнение как признак потолка), ИКР как формальный test минимальной достаточности → [`altshuller-1986-triz.md`](altshuller-1986-triz.md)
- [ ] **ARIZ** — алгоритм решения изобретательских задач (more procedural detail).

### AI-специфичное

- [ ] **GitHub Copilot research / Microsoft DevDiv studies** — empirical data про скорость AI-разработки.
- [ ] **Atalay 2026 «The Harness Problem»** — уже есть в lit-review трека 2 (cross-reference).
- [ ] arXiv: «AI-assisted code quality», «over-engineering AI» — поиск + триаж.

### Философия науки

- [ ] **Karl Popper** — фальсифицируемость, как формулировать проверяемые гипотезы.
- [ ] **William of Ockham** — бритва Оккама как методологический принцип.

## Обработанные работы

| Slug | Title | Year | Relevance | Tags |
|---|---|---|---|---|
| [brooks-1975-mythical-man-month](brooks-1975-mythical-man-month.md) | The Mythical Man-Month + No Silver Bullet | 1975/1986 | 5 | software-engineering, methodology, brooks-law, conceptual-integrity, no-silver-bullet, classic, foundation |
| [reliability-theory-classical-foundations](reliability-theory-classical-foundations.md) | Теория надёжности машин — series/parallel формулы, bathtub, minimum sufficiency | 1950-2025 (collective) | 4 | reliability-theory, machine-engineering, soviet-school, mtbf, bathtub-curve, series-parallel, redundancy, sufficiency |
| [altshuller-1986-triz](altshuller-1986-triz.md) | ТРИЗ — ИКР, S-кривая, противоречия, законы развития систем | 1969-2006 | 5 | triz, altshuller, soviet-engineering-school, ideal-final-result, s-curve, system-evolution, contradictions, minimum-sufficiency, classic |
| [arshinskiy-2019-software-systematization](arshinskiy-2019-software-systematization.md) | Принципы необходимости и достаточности в систематизации ПО — formal apparatus (¬A→¬B, 3 аспекта) | 2019 | 5 | prior-art, sufficiency-principle, necessity-principle, software-classification, russian-engineering-school, three-aspects, formal-logic, foundation |

## Не релевантные (помечены, чтобы не возвращаться)

| Slug | Title | Year | Причина |
|---|---|---|---|
| _нет записей_ | | | |
