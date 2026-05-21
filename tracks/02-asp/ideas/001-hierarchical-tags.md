# 001. Иерархические теги для поиска кода

- **Дата:** 2026-05-21
- **Автор:** soulhiler
- **Статус:** **under-investigation** — интерпретация уточнена + mini prior-art search завершён + toy implementation работает (2026-05-21)
- **История статуса:** stub (2026-05-21, утром) → draft (2026-05-21, дневная сессия, интерпретация выбрана) → under-investigation (2026-05-21, вечер, prior art search закрыт) → **with toy** (2026-05-21, поздний вечер, toy на AIrnd-репо работает)
- **Toy implementation:** [`001-toy/`](001-toy/) — рабочий генератор тегов + 5 тестовых запросов с baseline comparison.

## Простыми словами

Каждый кусок кода (функция, класс, файл) получает **метки в виде дорожек**, как папки в файловом дереве. Например:

- Функция `test_user_login()` получает метки `["test/unit", "test/auth", "feature/login"]`.
- Функция `test_api_endpoint()` получает метки `["test/integration", "test/api", "feature/api"]`.

При поиске:

- Запрос «test» — находит **обе** функции (потому что обе под `test/...`).
- Запрос «test/unit» — находит только первую.
- Запрос «feature/login» — находит только первую.

Это похоже на **фасетный поиск в интернет-магазинах** (Amazon: «Электроника → Телефоны → Apple» — каждый уровень сужает результат) или на **расширенные метки в GitHub Issues**, если бы они были вложенными.

**Гипотеза:** такие иерархические метки дадут **более точный поиск** для AI-помощника, чем плоские метки или embedding-поиск, особенно на запросах типа «найти все тесты для функции X» или «найти весь код безопасности».

## Гипотеза (формальная)

**H1:** Иерархические теги дают **precision@10 на ≥15% выше** по сравнению с плоскими тегами на запросах вида «найти все символы, относящиеся к категории X», на тестовом наборе из ≥100 запросов.

**H2 (вторичная):** Иерархические теги дают **comparable precision** с embedding-based retrieval (Continue-style), но при **значительно меньшем cold-start cost** (нет необходимости считать embeddings для миллионов чанков).

**Null hypothesis (H0):** Иерархические теги не дают статистически значимой разницы по сравнению с плоскими.

## Prior art search (выполнено 2026-05-21)

### Что найдено

1. **Semgrep — единственная production-реализация hierarchical taxonomy для кода.**
   - Rule namespace: `<language>/<framework>/<category>/$MORE` (например, `python/django/security/sqli-injection`).
   - Поля `category` (security / correctness / best-practice / performance / maintainability / portability) + `subcategory` (vuln / audit / guardrail).
   - Также: hierarchical metadata через CWE classifications.
   - Производство: тысячи rules, 45+ enterprises. **Подтверждает viability hierarchical metadata в коде.**
   - **Ограничение для нас:** Semgrep tags только для правил (rules), не для всех символов кодобазы. Scope ≠ наш scope (миллионы символов vs тысячи rules).
   - Источник тегов у них: manual (авторы правил пишут metadata). Конвенция-из-пути отсутствует.

2. **Hierarchical Faceted Metadata (CHI 2002, Hearst et al., UC Berkeley)** — академический фоундейшн.
   - Project «Flamenco» (UC Berkeley). 24-летняя established theory.
   - Hierarchical Faceted Categories (HFC) показали выигрыш vs кластеризация и плоские категории в user studies на library catalogs / scientific archives.
   - **Не применялось к code search** в этой работе. Это gap, который наша работа может закрыть.
   - Ссылка: <https://flamenco.berkeley.edu/papers/flamenco-shortpaper02.pdf>.

3. **SCIP (Sourcegraph Code Intelligence Protocol) — НЕ имеет hierarchical tags.**
   - `Kind` enum (86+ values: Class, Method, Function...) — **плоский namespace**.
   - `SymbolRole` bitset (Definition, Import, WriteAccess, ReadAccess, Generated, Test) — **плоские флаги**.
   - Hierarchical только в AST scope (`enclosing_symbol`, `enclosing_range`), не в categorical taxonomy.
   - **Это явный gap.** ASP может это закрыть.
   - Schema: <https://github.com/sourcegraph/scip/blob/main/scip.proto>.

4. **Sourcegraph code search** — boolean filters (language, repo, path, author), search contexts (boolean scoping). **Нет hierarchical tags.**

5. **ctags** — есть `kind` field (короткие однобуквенные коды: c, f, m) + AST scope hierarchy через `tracks scope for proper tag hierarchy`. Но это **scope hierarchy** (что внутри чего по синтаксическому дереву), не **categorical hierarchy** (test/unit vs test/integration). Different axis.

### Что значит для нашей идеи

- **Не начинаем с нуля** — есть established теория (CHI 2002) и одна production-реализация (Semgrep).
- **Не дублируем Semgrep** — у нас другой scope (все символы кодобазы) + другой источник тегов (convention-based из path + manual, а не только manual).
- **Закрываем явный gap в SCIP/LSIF** — применение hierarchical faceted theory к code intelligence через ASP.
- **Потенциальный contribution в трёх аспектах:**
  1. **Scope:** все символы кодобазы (не только security rules как у Semgrep).
  2. **Source:** convention-based (auto из path) + manual + LLM-inferred (вместо только manual).
  3. **Standard:** через открытую ASP-спеку (cross-tool), а не proprietary каждого инструмента.

### Уточнённая гипотеза (после prior art)

**H1 (base):** Иерархические теги для всех символов кодобазы дают precision@10 на ≥15% выше, чем плоские теги, на категорийных запросах. **Низкий риск** — Semgrep почти доказал это для своего narrower scope.

**H2 (ambitious):** Convention-based hierarchical tags + manual overrides дают comparable precision с embedding-based retrieval (Continue-style) при значительно меньшем cold-start cost. **Средний риск** — это unexplored area.

**H3 (research contribution):** ASP-стандартизированный hierarchical tag schema может стать accepted convention в OSS agent ecosystem (по аналогии с `.gitignore`). **Высокий риск** — adoption зависит от outreach, не только от данных.

### Что ещё проверить (после prior art search)

Из изначального плана остаются актуальными:

### Источник тегов (design choice)

**Критический вопрос:** как теги получаются?

| Источник | Pros | Cons |
|---|---|---|
| **Manual** (программист пишет `@tag` в комментарии) | Точно | Никто не пишет |
| **Convention-based** (из пути: `tests/unit/test_x.py` → `test/unit`) | Бесплатно, дисциплина repo | Не покрывает символов без явной структуры |
| **Inferred LLM** (LLM читает код, предлагает теги) | Гибко | Дорого, шум |
| **From config** (`.asp-tags.yml` со списком rules) | Контролируемо | Требует поддержки |

Скорее всего — комбинация: convention-based + manual для исключений.

### Baseline + treatment

Сравнить precision@10 на одном тестовом наборе:

- **Baseline 1:** ripgrep по тексту имени символа.
- **Baseline 2:** embedding similarity (Continue-style).
- **Baseline 3:** плоские теги (один уровень, без вложенности).
- **Treatment:** иерархические теги (≥2 уровня).

### Test dataset

| Вариант | Pros | Cons |
|---|---|---|
| Наш AIrnd-репо | Controlled, малый, мы знаем правильные ответы | Не репрезентативен для production кода |
| SWE-bench Lite | Индустриальный стандарт | Требует подготовки + он не про search, про fix |
| Aider's own evals | Публично доступен | Тоже не про search |
| Synthetic queries on большом OSS проекте (django, vscode) | Реалистично, масштабируемо | Нужно создать ground truth |

Скорее всего — **синтетические запросы на нашем репо + один-два средних OSS проекта**.

### Метрика

- **Главная:** precision@10 на ranked retrieval.
- **Вторичные:** recall, NDCG@10, query latency, cold-start indexing time.

### Pre-registration

Если решение проводить эксперимент — создать `experiments/exp-002-hierarchical-tags/PREREG.md` с финальной гипотезой, baselines, метриками, stop conditions. Сделать git tag `prereg/exp-002-hierarchical-tags/<date>`.

### Рекомендация после prior art search

**Идея валидна и worth pre-registration.** Конкретные next steps:

1. **Решение по интеграции с трек** — обсудить:
   - Стать **частью ASP-спеки** (как стандартизованный capability — `tagSchema: "hierarchical"`)? Это сильный signal.
   - Или оставить **отдельным экспериментом** (выпускается как отдельный paper / dataset, не часть ASP v0.1)?
2. **Прежде чем pre-reg — попробовать «toy implementation»** на нашем AIrnd-репо. Это дешёвая sanity check: посмотреть, дают ли convention-based hierarchical tags вообще sensible результаты на 25 файлах + 411 markdown sections.
3. **Связаться с автором Semgrep** (или просто прочитать их internal docs) — узнать, есть ли у них data на effectiveness hierarchical tags. Не factual paper, но industrial signal.
4. **Прочитать Hearst et al. CHI 2002** полностью — для design principles hierarchical facets (depth, balance, navigation UX).

## Связь с треком

- **Может повлиять на:** Stage 2a операции (`asp/findByTag({tag, hierarchical?})`).
- **Связано с:**
  - [Aider RepoMap](../lit-review/gauthier-2024-aider-repomap.md) — tree-sitter tags (но плоские: `name.definition.function`).
  - [GitNexus](../lit-review/patwari-2026-gitnexus.md) — typed edges (CALLS, REFERENCES). Категоризация по типу — близка, но не иерархична.
  - [Continue.dev](../lit-review/continuedev-2026-codebase-indexing.md) — embedding-based search. **Иерархические теги — структурная альтернатива embeddings.** Может быть **значительно дешевле** при сравнимой precision на категорийных запросах.
- **Стадия:** draft. Если mini prior-art search показывает gap → pre-reg эксперимента. Если кто-то уже сделал — записываем как «изученная prior art», корректируем подход или закрываем.

## Открытые вопросы

- **Q1 (приоритет):** Есть ли existing работы / инструменты, которые уже реализуют hierarchical tags для code search? — нужен mini prior-art search.
- **Q2:** Сколько уровней иерархии оптимально? Гипотеза: 2-3 (test/unit/auth — выше — diminishing returns).
- **Q3:** Как теги получаются? Авто из path? Manual в comments? LLM-inferred? **Это критический design choice.**
- **Q4:** Совместимо ли с embeddings? Можно ли комбинировать (hybrid: embedding similarity + tag filter)?
- **Q5:** Если идея валидна — это **отдельная ASP operation** (`asp/findByTag`) или **параметр существующей** (`asp/retrieve({filter: {tag: "test/unit"}})`)?

## Отклонённые интерпретации (для истории)

Изначально идея «иерархические теги» имела 4 разумных трактовки. После уточнения 2026-05-21 выбрана **интерпретация №3 (метки для поиска)**. Остальные не отбрасываются полностью — могут стать отдельными идеями в backlog:

- **Hierarchical tree-sitter tags** (def > callable > function вместо плоских) — потенциальная идея №002.
- **Hierarchical PageRank** (модули → файлы → функции на разных уровнях) — потенциальная идея №003.
- **Hierarchical token budget** (50% функциям, 30% классам, 20% модулям) — потенциальная идея №004.

Все три остаются как «возможно интересно» — но не активны.
