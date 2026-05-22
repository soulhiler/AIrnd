# The Harness Problem (Atalay 2026) + opencode-hashline

## Простыми словами

«Harness» — это слой инструментов (`read_file`, `write_file`, `apply_patch`, ...), который AI-агент использует, чтобы взаимодействовать с кодом. Atalay в блог-посте утверждает: **большинство багов агентов происходит не из-за LLM, а из-за harness'а** — слой искажает контекст, теряет информацию, заставляет модель «угадывать» что вокруг. Его лекарство — **детерминированный line addressing** (каждая строка получает hash, патчи по hash-у, а не по контексту).

Это **prior art**, которую мы пропустили в первом проходе литобзора. Записываю после того, как читатель Alex указал её в outreach feedback. Влияет на наши ADR 0003 (apply_patch design) и 0010 (read/write separation).

## Metadata

- **Authors:** Can Atalay (автор блога blog.can.ac).
- **Year:** 2026 (Feb).
- **Venue:** Personal blog post «The Harness Problem» (<https://blog.can.ac/2026/02/12/the-harness-problem/>) + open-source реализация в [opencode-hashline](https://github.com/izzzzzi/opencode-hashline) (плагин для OpenCode harness).
- **arXiv / DOI:** —
- **Citation key:** atalay-2026-harness-problem
- **Дата прочтения:** 2026-05-22 (после outreach feedback).
- **Relevance (1–5):** **5** — прямая prior art для нашего ADR 0010 (read/write separation) и для дизайна `asp_applyPatch`. Также — meta-level: указывает на то, что наш литобзор был **incomplete** (пропустили эту работу при первом проходе).
- **Tags:** harness, tool-surface, line-addressing, hashline, opencode, agent-tools, prior-art, **critical**

## TL;DR

«Harness problem» — это эффект, когда **искажения, теряющие информацию,** в layer между LLM и кодом приводят к багам, которые **ошибочно списываются на ошибки модели**. Atalay показывает на конкретных примерах (str_replace patches, search-and-replace через context matching), что harness заставляет модель угадывать неоднозначные surround-контексты. Его предложение — **«hashline»**: каждая строка получает детерминированный `lineNumber:hash` тег при чтении, патчи адресуют конкретные строки по hash, FNV-1a whole-file revision rejects stale-context edits с `FILE_REV_MISMATCH`. Реализован как плагин для OpenCode (один из популярных OSS coding harnesses).

## Key claims

- **Claim 1 — «Harness layer loses information and introduces errors».** Quote (из README): *«The model sees content but must 'guess' surrounding context for search-and-replace»*. Это фундаментальный для design tool-API наблюдение: **минимизируй ambiguity**.
- **Claim 2 — «Hashline через детерминированный line tag elimines context-guessing».** Каждая строка получает `lineNumber:hash` префикс (`#HL` annotation в выводе read). Патчи адресуют по hash, не по surrounding context — это **eliminates the entire class of "context drift"** ошибок.
- **Claim 3 — «File-level revision check предотвращает stale-context edits».** FNV-1a 8-hex whole-file hash. Если файл изменился между read и write — patch отклоняется с `FILE_REV_MISMATCH` без необходимости merge logic. Это **lighter-weight** альтернатива git-style three-way merge.
- **Claim 4 — «Read и write tools должны различаться формой output».** Quote (из README): «*File-read tools receive annotated output (with `#HL` prefixes); file-edit tools have prefixes stripped before argument processing.*» Read tool **добавляет** hash-метки; write tool **снимает** их перед обработкой. Это **structurally enforced separation** read vs write surface.
- **Claim 5 — «Tool detection через naming heuristics».** Quote: *«the tool name (case-insensitive) is compared against the allow-list: read, file_read, read_file, cat, view»*. Хотя ASP даёт формальное `safetyClass` поле, hashline показывает, что **prefix-based naming convention** работает в production OSS harnesses прямо сейчас, без spec change.

## Methodology

Blog post — opinion piece с примерами; не academic paper. opencode-hashline — production plugin, validated через user adoption (OpenCode community). Метрики не приведены — только anecdotal «работает лучше».

## Gap (для нашего трека)

### Что Atalay НЕ покрывает

- **No formal protocol.** Hashline — это плагин для OpenCode harness, не cross-tool spec. Не диктует, как другие harnesses должны интегрировать.
- **Limited to line-oriented editing.** Hash-line адресация хорошо работает на text-files; не понятно как масштабируется на binary diff или structural edits (AST-level rename).
- **No retrieval / context-selection mechanic.** Hashline не касается «как выбрать какие файлы LLM показать» — это слой ниже (Aider RepoMap / Continue.dev territory).

### Что из Atalay стоит **немедленно** включить в ASP

1. **Stale-context detection в `asp_applyPatch`.** Сейчас наш applier просто бросает `PatchConflictError` если контекст не совпал. Стоит ввести **explicit `fileRev`** параметр (FNV-1a-style hash) и отказывать на mismatch с понятной семантикой («файл изменился со времени твоего read, прочитай заново»). Это **прямое adoption hashline pattern**.
2. **Line-tagged output mode в `asp_readFile`.** Опциональный `format: "lineTagged"` который возвращает `1:abcd│actual line` per line. Агенты, поддерживающие hashline, используют hash; остальные игнорируют.
3. **Tool naming convention enforcement.** Hashline допускает edit-tools только при exact-match в allow-list. Наш `safetyClass: "destructive"` — формальный аналог. Можно cross-reference в spec.
4. **Read/write separation через output annotation, не только через capability flag.** Hashline structurally разделяет surface (annotated vs non-annotated output). Это **fundamentally сильнее**, чем env-flag, который мы добавили в ADR 0010.

### Где Atalay усиливает наш дизайн

- **Подтверждает наш ADR 0010 fundamentally правильным.** Read и write — это разные surface, разные trust levels. Hashline идёт дальше — **structurally enforces** через annotation. Наш env-flag — minimum viable; output annotation — natural Stage 2c+ улучшение.
- **Подтверждает важность token budget.** Hashline annotation добавляет overhead (~10-15% tokens на line tags). Этот overhead **acceptable**, потому что устраняет class ошибок. У нас token budget — first-class, что согласуется.

## Open questions

- **Q1: Можно ли встроить hashline-style annotation в ASP без breaking change v0.1?** Возможно: добавить `format: "lineTagged"` опциональный параметр в `asp_readFile`. Сервер advertise `lineAnnotation: true` в capabilities.
- **Q2: Как hashline масштабируется на binary / generated files?** Atalay не покрывает.
- **Q3: Существует ли overlap с tree-sitter-based line resolution?** Если tree-sitter может дать стабильный symbol ID (`python:mod.Class.method`), нужен ли вообще `lineNumber:hash`? Hashline даёт более низкоуровневую гранулярность.
- **Q4: Adoption в других harnesses?** Hashline сейчас живёт в OpenCode. Если Cline / Goose / Aider не примут — это nice-to-have, не industry standard.

## Related work cited

- **OpenCode** — coding harness, в который hashline встраивается как плагин.
- **str_replace / search-and-replace patch tools** — критикуется Atalay как фундаментально неоднозначные.
- **Anthropic Claude Sonnet / OpenAI GPT** — модели, которые Atalay тестирует.
- Косвенно: **diff3 / git merge** — три-way merge как альтернатива (rejected как слишком тяжёлый для агентов).

## Личные заметки

### Что зацепило

- **Atalay'a thesis is essentially наш ADR 0010 written first и более конкретно.** Мы пришли к похожему выводу через outreach feedback. Он пришёл через product engineering experience. **Convergent evolution** — это хороший signal, что мы на правильном пути.
- **FNV-1a 8-hex file revision** — surprisingly simple solution для stale-context detection. Должны adopt в `asp_applyPatch`.
- **Naming heuristic как safety classifier** — OpenCode hashline не требует spec change, использует existing naming convention. Это **lesson для нас**: не каждое security improvement требует ADR. Иногда наименование tool достаточно.

### С чем не согласен

- **Hashline binds к line-oriented edits.** AST-level edits (rename, extract method, inline variable) теряют преимущество. Для нашей роли (code intelligence, не текстовый редактор) это limitation.
- **Plugin-based deployment.** Hashline нужно install per-harness. Cross-harness стандарт это не даёт. ASP пытается быть protocol-level — комплементарно, но не replacement.

### Идеи для ASP design

1. **`asp_readFile({format: "lineTagged"})`** в Stage 2c полишинге — return `lineNumber:fnv1a4│content` per line. Capability `lineAnnotation: true`.
2. **`asp_applyPatch({fileRev: "<hash>"})`** required parameter when destination file existed. Stale-context errors return `staleFileRev` с currentRev для retry.
3. **Spec Section 9.x:** новое sub-section «Stale-context detection» — описать `fileRev` semantics.
4. **Lit-review meta-update:** добавить в lit-review survey статус «adversarial outside review pending». Текущий лит-обзор был мой single-pass — Atalay's gap показал что это weakness, не feature.

### Meta-lesson: outreach **раньше** литобзора-закрытия

Наш литобзор закрыли через 1 день. Atalay вышел в outreach после 1 outreach-message. **Если бы мы делали outreach в parallel с lit-review** (а не после), мы бы получили этот pointer на 3 недели раньше. **Это lesson для будущих треков** — не «закрыть литобзор → outreach», а «early outreach → continuous lit-review».

### Cross-references к нашим артефактам

- **ADR 0010** — этот ADR cites hashline как inspiration для read/write separation philosophy.
- **ADR 0003 (reference impl scope)** — `asp_applyPatch` сейчас не имеет stale-context detection. Это **gap**, который мы должны закрыть в v0.1.2.
- **Spec Section 6.4.2** — `asp_applyPatch` params должны расширены `fileRev` (опциональный сейчас, eventually required).
- **Spec Section 6.2.1** — `asp_readFile` должен expose `format` option.
- **Survey lit-review/_prior-art-survey.md** — нужно обновить, отметив что наш survey miss-нул harness-level prior art. Meta-improvement для будущих треков.
