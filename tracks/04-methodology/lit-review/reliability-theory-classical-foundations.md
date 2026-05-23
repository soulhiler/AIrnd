# Теория надёжности машин и механизмов — классические основы

## Простыми словами

Это **не одна работа**, а **семейство классических концепций** из инженерии машин 1950-1980-х (советская школа, MIL-стандарты, академическая база). Дружинина Б. С. в открытом доступе через web не нашёл — поэтому пишу обобщённую запись по доступным источникам (Wikipedia ru, белорусский учебник Шевченко, западные learning resources). Это **честная компромисс-запись**, а не полноценный анализ конкретного автора.

Основная идея: **надёжность системы — это не свойство одной детали, это математически вычисляемая величина** через комбинацию надёжностей частей. Чем больше деталей соединены последовательно — тем ниже общая надёжность (произведение). Чем больше резервирования — тем выше (но дороже). Есть **bath-tub curve**: большой fail rate в начале (детские болезни) → стабильный низкий → опять высокий в конце (износ).

**Зачем нам:** наш ключевой вопрос — переносится ли это в software. Если переносится — у нас есть **математический язык** для описания, почему overcoding опасен.

## Metadata

- **Authors:** Семейство классических работ. Конкретные первоисточники, которые **не достали** через web:
  - Дружинин Б. С. — серия монографий по надёжности машин и оборудования (1960-1980-е).
  - Орлов И. А. — инженерная школа надёжности.
  - MIL-HDBK-217 — американский военный стандарт расчёта надёжности электронных систем.
- **Что использовано как замена:**
  - [Wikipedia ru — Теория надёжности](https://ru.wikipedia.org/wiki/Теория_надёжности) — общий очерк.
  - Шевченко Д. Н., «Основы теории надёжности» (БГУТ, учебник, PDF).
  - [«Reliability Engineering Theory and Practice» (Bazargan-Harandi, open textbook)](https://opentextbc.ca/oerdiscipline/wp-content/uploads/sites/213/2018/09/Reliability-Engineering.pdf).
  - [«Guide to Series and Parallel Reliability» (numberanalytics)](https://www.numberanalytics.com/blog/series-parallel-reliability-guide).
  - **Не достали:** cyberleninka статья «Принципы необходимости и достаточности в систематизации программного обеспечения» — это **была бы прямая prior art** на наш вопрос «переносится ли минимальная достаточность в software», но HTTP 403. **Стоит попробовать достать через другие каналы.**
- **Year:** 1950-2025 (collective, не одна работа).
- **Citation key:** reliability-theory-classical-foundations
- **Дата прочтения:** 2026-05-23.
- **Relevance (1–5):** **4** — релевантно, но это **обобщение**, не глубокое чтение конкретного классика. Понизил с 5 до 4 за неполноту источников.
- **Tags:** reliability-theory, machine-engineering, soviet-engineering-school, mtbf, bathtub-curve, series-parallel, redundancy, principle-of-sufficiency

## TL;DR

Классическая теория надёжности оперирует **вероятностью отказа** на единицу времени. Базовые формулы: для последовательного соединения N компонентов с надёжностями `P_i` общая надёжность системы `= ∏ P_i` (произведение — снижается быстро). Для параллельного резервирования `= 1 − ∏(1 − P_i)` (растёт за счёт дублирования). Жизненный цикл компонента описывается **bath-tub кривой**: высокий fail rate в начале → стабильный низкий в useful life → растущий в wear-out. Принцип **минимальной достаточности** (советская инженерная школа): каждая деталь имеет ровно столько усложнения, сколько нужно для функции — избыточные детали = новые точки отказа. Принцип **non-monotonicity избыточности** (современные работы): чрезмерное дублирование **ухудшает** надёжность, потому что добавляются новые failure paths.

## Key claims

- **Claim 1 — Series system formula.** Надёжность последовательной системы `P_sys = ∏ P_i`. Следствие: добавление любого компонента **строго понижает** общую надёжность. Это математически строгое утверждение для машин.
- **Claim 2 — Parallel redundancy formula.** Резервирование: `P_parallel = 1 − ∏(1 − P_i)`. Растёт быстрее single component, но **не неограниченно**.
- **Claim 3 — Bath-tub curve.** Failure rate: высокий → низкий → высокий. Три механизма: производственные дефекты, случайные отказы, износ.
- **Claim 4 — Redundancy paradox (современная переработка).** Добавление параллельных компонентов сверх некоторого N **снижает** надёжность через увеличение complexity путей отказа. Reliability function становится **non-monotonic** и **concave**.
- **Claim 5 — Single point of failure (SPF).** Компонент без резерва, через который проходит критический путь — limit на общую надёжность. Устранение SPF — стандартное правило хорошего дизайна.
- **Claim 6 — Principle of minimum sufficiency (советская школа).** Каждая деталь имеет ровно столько усложнения, сколько нужно для функции, **не больше**. Любое сверх-усложнение = новый отказ-mode. Это **этическое + техническое** правило, не только математика.

## Methodology

Классические probabilistic models, валидированные через десятилетия инженерной практики (авиастроение, военная техника, атомная промышленность). Не «эмпирические эксперименты в лаборатории» — это **обобщение производственного опыта** в математических формах.

В современной литературе — расширения через optimisation (как найти optimal redundancy при cost constraints), Markov chains для модели repairs, Weibull distributions для wear-out.

## Gap (для нашего трека)

### Что переносится прямо

1. **Series formula → software.** Цепочка вызовов в коде: если функция A вызывает B вызывает C, и каждая имеет вероятность бага `p_i`, то цепочка имеет суммарную вероятность бага `≈ 1 − ∏(1 − p_i)`. Чем длиннее путь — тем выше шанс падения. **Это математически такая же формула**, как для машин.
2. **Single point of failure → software.** Невычистимая абстракция, через которую проходят все ключевые операции — direct analog. Устранение SPF в software — стандартное правило.
3. **Principle of minimum sufficiency → наш центральный вопрос.** Каждая фича/строка/файл = новый отказ-mode. Если эта философия работает для машин — должна работать для software. Это **прямая основа** для нашей H1 (overcoding → больше багов).

### Что НЕ переносится прямо

1. **Bath-tub curve.** Software не «изнашивается» физически. Но **рифмуется**: ранние баги после деплоя (infant mortality), стабильный low-bug-rate (useful life), wear-out как «зависимости устаревают, API меняются». Это **не identical**, но useful analogy.
2. **MTBF measurement.** В машинах MTBF measurable через physical testing. В software «отказ» определяется через user-reported bug или test failure — субъективно, ситуативно. Direct measurement сложнее.
3. **Parallel redundancy.** В software резервирование — это replicated systems (HA clusters), не «два экземпляра одного кода». Не каждый компонент можно «продублировать».
4. **Stochastic failure model.** Машины ломаются по случайным распределениям. Программы — детерминированно (или по детерминированным path сценариев). Probabilistic framing нужно адаптировать.

### Где можно сделать ноу-хау переноса

- **«Series formula для AI-generated chains».** Каждая дополнительная операция в спеке = `N+1` в произведении. Каждая дополнительная зависимость npm = `N+1`. Если каждый компонент имеет `p_baseline = 0.99` надёжности, то 12 операций ASP дают `0.99^12 ≈ 0.886` — то есть **11.4% шанс что хоть один сломан**. Это **измеримо**, и это **прямое предупреждение** о scope creep.
- **«Redundancy paradox для feature flags».** Каждый opt-in / fallback в ASP (например, embeddings или нет, rerank или нет) — это «redundant path». По теории — после некоторого N это **ухудшает** надёжность через combinatorial complexity. Подтверждается нашим опытом: `ASP_ENABLE_EMBEDDINGS` / `ASP_RERANK_PROVIDER` / `ASP_SKIP_GITIGNORE` — каждый flag добавляет surface для багов.
- **«Wear-out для software зависимостей».** Не код стареет, а **окружение**: npm packages deprecate, Node major versions ломают ABI, OS требования эволюционируют. У нас в треке 2: web-tree-sitter pinned на 0.22, потому что 0.26 breaks ABI — это **wear-out signal** прямо сейчас.

## Open questions

- **Q1:** Существует ли formal модель «software reliability через series-parallel»? Краткий поиск показывает, что есть **software reliability engineering** как отдельная дисциплина (Musa, Iannino, Okumoto), но я её ещё не глубоко читал. Это **next item** для литобзора.
- **Q2:** Принцип минимальной достаточности — есть ли formal proof, что violation увеличивает bug rate? Или это empirical observation?
- **Q3:** Cyberleninka статья «Принципы необходимости и достаточности в систематизации ПО» — **критическая** prior art, нужно достать другим способом (Sci-Hub, межбиблиотечный, прямой контакт автора).
- **Q4:** Bath-tub curve для AI-generated software — какая форма? Гипотеза: «infant mortality phase растянута во времени, потому что AI код не уходит в production immediately».

## Related work cited

Прямо в записях не цитировал (нет первичных текстов в руках). Но контекстно связано:

- **Musa, Iannino, Okumoto** — «Software Reliability» (1987) — formal extension theory надёжности на software. **Не читал, должен** добавить отдельной записью.
- **Lyu (ed)** — «Handbook of Software Reliability Engineering» (1996) — академический справочник.
- **NIST SP 800-53** — security & reliability в US federal contexts.
- **IEC 61508** — functional safety стандарт (атомка, аэрокосмос).

## Личные заметки

### Что зацепило

- **Series formula** даёт **количественный** аргумент против добавления операций. Раньше я говорил «60% overcoding», но это качественная оценка. Если каждая ASP операция = independent failure mode с `p_fail = 1−p_baseline`, то 12 операций × ~1% базовая bug rate = **~11% шанс падения** в любой сессии. Это **очень конкретное** число, measurable.
- **Redundancy paradox** — против моих собственных решений в треке 2. Я добавлял env flags «на всякий случай» (`ASP_RERANK_PROVIDER`, `ASP_SKIP_GITIGNORE`, и т.д.). По теории каждый flag — это **новый failure path** в combinatorial sense. Не «улучшение flexibility», а **снижение** надёжности.
- **Принцип минимальной достаточности** даёт мне **этический + математический** язык для нашего трека 4. Не «overcoding это плохо потому что ну я так чувствую», а «потому что в инженерной школе 70 лет известно, что лишние компоненты = больше отказов, доказано».

### С чем не согласен / что бы сделал иначе

- **Bath-tub curve буквально не переносится.** Software не имеет физического wear-out. Но я бы не отбрасывал — есть «logical wear-out» через зависимости. Нужно отдельно формализовать.
- **«Случайные отказы» машин vs детерминированные баги software.** Machines fail случайно во времени; software fail когда выполняется конкретный path. Это **другая природа** отказа. Probabilistic framing может ввести в заблуждение если применять буквально.

### Идеи для трека 4

1. **Метрика «expected failure rate» из series formula** как количественный baseline для overcoding budget. Не «60% redundant», а «P(any operation fails per session) > 10% → reduce scope».
2. **Audit env flags как redundancy paradox case.** Каждый flag — это новая ось вариативности; combinatorial explosion может dominate надёжность. Это **проверяемая гипотеза** на нашем asp-ref.
3. **«Logical wear-out» как новый concept** для software — формализация зависимостей-как-износ. Аналог: web-tree-sitter pin на 0.22 = у нас **бомба замедленного действия**.

### Cross-references

- **ADR 0002 трека 4 (классы проектов)** — series formula даёт количественное обоснование, почему «большой класс» (1500-5000 LOC) даёт ожидаемо больше багов на единицу: `∏(1 − p)` растёт с N components.
- **Brooks** (lit-review #1) — Brooks «conceptual integrity through one architect» — это **этический** аналог принципа минимальной достаточности. Математика теории надёжности **усиливает** интуицию Брукса.
- **Case study трека 2** — все 12 операций ASP были добавлены без учёта series formula. Если применить ретроспективно: ожидаемая bug rate ≈ 11% на сессию для 12-операционного сервера. Round 1 audit нашёл 5 багов из 5 секций кода ≈ **100% rate** в первом проходе. Это **выше предсказания**, что означает либо (a) baseline `p_bug` сильно выше 0.01, либо (b) операции не **independent** (один баг в общем модуле каскадирует).
- **Open question Q3 (cyberleninka)** — критичная prior art, нужно достать. Если статья формализовала перенос, мы стоим на их плечах, а не reinventing.

## Источники

- [Wikipedia ru — Теория надёжности](https://ru.wikipedia.org/wiki/Теория_надёжности)
- Шевченко Д. Н., «Основы теории надёжности», БГУТ (PDF, elib.bsut.by)
- [«Reliability Engineering Theory and Practice» (Bazargan-Harandi, open textbook)](https://opentextbc.ca/oerdiscipline/wp-content/uploads/sites/213/2018/09/Reliability-Engineering.pdf)
- [«Guide to Series and Parallel Reliability» (numberanalytics)](https://www.numberanalytics.com/blog/series-parallel-reliability-guide)
- [The Bathtub Curve (Innovation.world)](https://innovation.world/invention/bathtub-curve/)
- [«Reliability of Systems» (IntechOpen)](https://www.intechopen.com/chapters/50094)
- [Optimal redundancy ScienceDirect](https://www.sciencedirect.com/science/article/abs/pii/S0951832022002149)
- **Недоступные** (важно отметить): cyberleninka — статья про принципы достаточности в ПО, конкретный текст Дружинина.
