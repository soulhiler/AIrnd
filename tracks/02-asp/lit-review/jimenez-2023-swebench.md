# SWE-bench — Evaluation Benchmark для AI-помощников на реальных GitHub issues (Princeton NLP)

## Простыми словами

**SWE-bench** (читается «свибенч») — это **набор задач для проверки**, насколько хорошо AI-помощник умеет решать **реальные проблемы в коде**. Создан в Принстонском университете в 2023 году. Это **стандартный экзамен в индустрии**: все производители AI-помощников (Anthropic, OpenAI, Devin, Cursor) меряются на нём.

**Как устроен экзамен:**

1. Берётся **реальная задача с GitHub** из настоящего open-source проекта (например: «исправь баг X в библиотеке Django»).
2. AI-помощнику показывают **состояние проекта до исправления** и **текст задачи**.
3. AI-помощник должен **написать патч** (текст изменений), который решает задачу.
4. Патч прогоняется через **автоматические тесты**. Прошёл — задача засчитана.

**Размеры экзамена:**

- **Полная версия:** 2294 задачи (долго).
- **«Лайт»-версия:** 300 задач (быстрая проверка).
- **«Verified»-версия:** 500 задач, **проверенных вручную** на адекватность (OpenAI + Princeton).

**Почему важно для нашего стандарта:**

1. **Это наш будущий экзамен.** На Этапе 3 → 4 (если до него дойдём) мы должны будем **измерить**, действительно ли AI-помощники с нашим стандартом лучше решают задачи, чем без него. SWE-bench — общепринятый тест.
2. **Это уже Docker-контейнер.** Принстон сделали так, что любой может запустить — нужен только Docker + 16 ГБ оперативки + 120 ГБ диска. Нам не надо изобретать свой бенчмарк.
3. **Это «правда».** Реальные задачи из реальных проектов — не игрушечные примеры. Если что-то работает на SWE-bench — оно работает в жизни.

## Metadata

- **Authors:** Carlos E. Jimenez, John Yang, Alexander Wettig, Shunyu Yao, Kexin Pei, Ofir Press, Karthik R. Narasimhan (Princeton NLP)
- **Year:** 2023 (initial release Oct 2023); Verified version 2024 (OpenAI + Princeton)
- **Venue:** arXiv: <https://arxiv.org/abs/2310.06770> (paper); ICLR 2024 (peer-reviewed); ongoing benchmark с public leaderboard at <https://swebench.com>
- **arXiv / DOI:** 2310.06770
- **Citation key:** jimenez-2023-swebench
- **Дата прочтения:** 2026-05-21
- **Relevance (1–5):** **5** — наш **будущий evaluation harness**. Без него Gate 3 → 4 (статистическая значимость) недостижим. Также **industry standard** — без bench на SWE-bench paper / RFC не будет признан.
- **Tags:** evaluation, benchmark, llm-coding, github-issues, swe-bench, princeton-nlp, must-use

## TL;DR

SWE-bench — benchmark dataset из 2,294 real-world GitHub issues + corresponding code fixes, собран из 12 popular Python repositories (Django, scikit-learn, sympy, и т.д.). Каждая задача: codebase + issue description + ожидаемый patch + tests, которые валидируют patch. Variants: full (2,294), Lite (300, для speed), Verified (500, OpenAI+Princeton manual curation). Docker-based containerized evaluation harness (с июня 2024). Leaderboard at <https://swebench.com>. Multimodal variant 2025-01. **Industry standard** для evaluation AI-помощников; Anthropic, OpenAI, Devin (Cognition), Cursor, Continue все meryalis на нём.

## Key claims

- **Claim 1 — «Real-world issues, не synthetic».** Quote (paper abstract): *«SWE-bench: a benchmark of 2,294 software engineering problems drawn from real GitHub issues and corresponding pull requests across 12 popular Python repositories»*. Это **critical methodology choice** — synthetic benchmarks (HumanEval, MBPP) измеряют isolated function generation; SWE-bench measures **integration in actual codebases**. **For ASP это значит:** наш бенч должен быть на real-world codebases, не toy.
- **Claim 2 — «Multi-stage filtering для quality».** Quote (paper): *«We construct SWE-bench by carefully filtering and verifying GitHub issues to ensure they have... clear test cases, no flaky tests, no security implications»*. **Quality > quantity**. **Lesson для наших experiments:** invest в curation.
- **Claim 3 — «Variants для different use cases».**
  - **Full (2,294):** comprehensive evaluation, slow.
  - **Lite (300):** quick iteration, used by most researchers.
  - **Verified (500):** «provably solvable» by humans, used for production claims.
  - **Multimodal (2025):** включает screenshots/diagrams, не только text.

  **For ASP это значит:** мы будем использовать **Lite** для iteration в Gate 2 → 3, **Verified** для final claims в Gate 3 → 4.
- **Claim 4 — «Containerized evaluation».** Quote: *«fully containerized evaluation harness using Docker for more reproducible evaluations»* (since June 2024). Each repo + issue has dedicated Docker image. Reproducibility — built-in. **Implication:** наши experiments в `tracks/02-asp/experiments/` будут использовать SWE-bench's Docker pattern.
- **Claim 5 — «Public leaderboard, 80+ approaches submitted».** Quote (recent paper, Jun 2026): *«SWE-Bench Lite (79 entries) and Verified (99 entries) leaderboards»*. **Это означает saturated competitive environment** — наш ASP должен **convincingly demonstrate gain over existing approaches**, не просто «not worse than baseline».

## Methodology

SWE-bench's own methodology (paper Section 3):

1. **Repository selection:** 12 popular Python repos (Django, sympy, scikit-learn, и т.д.) — chosen для widespread relevance and active test suites.
2. **Issue extraction:** GitHub issues that resulted в merged PRs.
3. **Filtering:** issues с (a) clear text, (b) corresponding code fix, (c) reliable test cases, (d) no security implications.
4. **Construction:** для каждой задачи — Docker image с codebase в pre-fix state + test runner.
5. **Evaluation:** LLM/agent receives codebase + issue → produces patch → tests run → success/fail.

**Метрика:** % issues resolved (binary per-issue → average across dataset).

## Gap (для нашего трека)

### Что SWE-bench НЕ покрывает (потенциально gap для нашей evaluation)

- **Python-only** — все 12 repos на Python. **Не measures Java/Go/Rust/TypeScript performance.** Для ASP это **серьёзный constraint** — мы хотим language-agnostic claims. **Mitigation:** secondary benchmark на TypeScript / Java (например, SWE-bench Multilingual когда появится).
- **Bug-fix-focused tasks.** Most issues — bug reports. **Less measures:**
  - Feature implementation.
  - Refactoring.
  - Code navigation / exploration (Cline's use case).
  - Documentation editing.

  **Для ASP capability negotiation** мы хотим показать improvement в **разных task types**, не только bug fixes.
- **Solo agent assumed.** SWE-bench evaluates LLM + tools as **single agent**. Multi-agent collaboration (где один agent indexes, другой queries) — не measured. **Для ASP это relevant** — мы хотим демонстрировать **separation indexing-server / querying-client** value.
- **Static initial state.** Task says «fix issue в current code». **No measure of cold-start**: насколько быстро agent becomes productive on **new codebase**. **For ASP это important** — pre-built index (GitNexus, Aider) requires upfront cost, on-demand reading (Cline) — нет. Trade-off измеримый, но SWE-bench не его measures directly.
- **Public leaderboard tooling може overfit.** 80+ submissions — некоторые researchers могут train на SWE-bench-similar data. **Risk:** наш ASP может тоже implicitly overfit если мы целим to leaderboard.

### Что из SWE-bench стоит переиспользовать

1. **Docker-based harness** — мы adopt this pattern для своих experiments.
2. **Real-world tasks principle** — не synthetic. Если мы создаём свой mini-benchmark (например, hierarchical-tags-precision-bench) — он должен быть из real codebases.
3. **Multi-tier evaluation** (Full / Lite / Verified) — adopt в наших experiments.
4. **«Issue → patch → test»** structure — мог бы быть task structure для нашей hierarchical tags benchmark (ADR 0004 follow-up).
5. **Public leaderboard as community norm** — для ASP, если мы выпускаем benchmark, leaderboard ускоряет adoption.

## Open questions

- **Q1: Multilingual SWE-bench coming?** If yes — when? Это критично для нашего ASP positioning (language-agnostic claims).
- **Q2: Как современные approaches справляются с задачами requiring extensive codebase exploration?** Это **direct measure** value «pre-built index» vs «on-demand reading» — что мы хотим quantify.
- **Q3: ASP-aware approach** — если LLM + (Cline + ASP-сервер) выполняют SWE-bench task, is improvement measurable? **This is the core experiment of Gate 3 → 4.**
- **Q4: Cost / latency** не включены в primary metric. Devin / Cursor могут brute-force с большим budget. **Для production ASP** мы хотим also measure cost-per-task.
- **Q5: Что считается «решённой»** задачей — все tests passing, или partial credit? Текущий metric binary; partial credit может быть more informative.

## Related work cited

- **SWE-bench paper:** Jimenez et al., «SWE-bench: Can Language Models Resolve Real-World GitHub Issues?», arXiv 2310.06770, ICLR 2024.
- **SWE-bench Verified announcement (OpenAI):** <https://openai.com/index/introducing-swe-bench-verified/>.
- **SWE-bench source:** <https://github.com/swe-bench/SWE-bench>.
- **Public leaderboard:** <https://swebench.com>.
- **Hugging Face dataset:** <https://huggingface.co/datasets/princeton-nlp/SWE-bench_Verified>.
- **Recent analysis paper:** «Dissecting the SWE-Bench Leaderboards» (arXiv 2506.17208).
- **SWE-Fixer (training open-source LLMs)** — arXiv 2501.05040, может быть отличной prior art для evaluation methodology.
- **SWE-Bench+ (enhanced version)** — arXiv 2410.06992.

## Личные заметки

### Что зацепило

- **Industry-standard now.** Все publish on it. **Если ASP не measured on SWE-bench — paper не примут** в top venue (NeurIPS, ICLR, ICSE).
- **Verified version (500 tasks)** — sweet spot между size и quality. **Для Gate 3 → 4 — это наш target dataset.**
- **Docker containerization** — reproducibility built-in. Это **major productivity boost** для нашего experimental harness.
- **80+ approaches submitted** — saturated environment. **Implications для positioning:** ASP must show **clear differentiation** (not just «yet another agent»), а скорее **enabling architecture** (better serverов = better agents → better SWE-bench scores).

### С чем не согласен

- **Python-only — significant limitation.** Если ASP claims language-agnostic — нужен complementary multilingual benchmark.
- **Binary metric (pass/fail)** — coarse. Partial credit, edge cases, time-to-solve — все important для real-world utility. **Для наших experiments** — measure ⋅ multiple aspects, не только pass rate.
- **No collaboration/multi-agent evaluation** — gap для ASP storyline.

### Идеи

1. **Pre-registration template** для всех `experiments/` в нашем треке — должна включать **Docker setup** (inspired by SWE-bench).
2. **Internal mini-benchmark** для testing ASP **operations** (find-by-tag, retrieve, impact). Build it **using SWE-bench's методология** (real tasks, manual curation, Docker).
3. **На Gate 3 → 4:** run **multi-condition experiment**: same LLM + (Cline alone) vs (Cline + ASP server). Measure SWE-bench Lite. Это **direct test нашей гипотезы**.
4. **Outreach к SWE-bench team** — Princeton NLP. Если ASP помогает improve SWE-bench scores в reproducible way — это **submittable как leaderboard entry**. **Boost adoption signal.**

### Cross-references

- **ADR 0001:** SWE-bench validates что AI-helper для real-world коде — well-defined research area.
- **ADR 0002:** SWE-bench leaderboard contestants — mostly **commercial** (Devin, Cursor) + some open (SWE-agent). Per ADR 0002 — наш target audience остаётся OSS. Но SWE-bench как evaluation framework — applicable.
- **ADR 0003:** Reference impl will be evaluated на SWE-bench Lite сначала, Verified для финального paper.
- **ADR 0004 (hierarchical tags):** SWE-bench tasks могут быть annotated иерархическими tags для measure tagging's impact on retrieval precision. **Idea для follow-up experiment.**
- **Cline lit-review:** Cline's «on-demand reading» approach has not been independently evaluated на SWE-bench (наskolко мне известно). **Это potential measurement** — adds value к нашему трек.
