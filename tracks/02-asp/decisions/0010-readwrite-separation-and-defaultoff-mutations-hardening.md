# 0010. Read/write separation + default-off mutations + secret hardening

- **Дата:** 2026-05-22
- **Статус:** accepted
- **Связанные ADR:** [0003](0003-reference-implementation-cleanroom-build-with-gitnexus-parity-5-fixes.md), [0007](0007-storage-backend-stage-2a-sqlite-with-fts5.md)
- **Происхождение:** внешний security audit от Alex (первый респондент в outreach, 2026-05-22).

## Простыми словами

Первый внешний читатель пытался подключить `asp-ref` к своему рабочему проекту и **отказался это делать**, потому что нашёл 5 конкретных дыр в безопасности. Этот ADR фиксирует, что мы поменяли:

1. **Деструктивные операции** (запись файлов, патчи) теперь **выключены по умолчанию**. Нужно явно выставить `ASP_ENABLE_MUTATIONS=1`.
2. **Чтение секретов** (`.env`, ключей, credentials) теперь **запрещено везде** — и в индексаторе, и в `asp_readFile`. Раньше индексатор их пропускал, а чтение по прямому имени всё равно работало.
3. **Symlink escape** — раньше можно было через симлинк выйти за корень репо. Теперь сервер использует `realpath` для проверки, что путь реально внутри.
4. **`.asp/` в `.gitignore`** добавляется автоматически при первом запуске. Раньше пользователь должен был сам добавить.
5. **Список зависимостей** проаудитирован (`npm audit`).

Также — большая концептуальная мысль от Alex: **чтение и запись — это два разных уровня доверия**. Их надо разделять. Пока мы это сделали через env-флаг; в будущем может быть смысл сплитнуть на два отдельных сервера (`asp-ref-read`, `asp-ref-write`).

## Context

Outreach задумывался по ADR 0005 именно для того, чтобы получить внешний reality-check до того, как мы начнём двигаться дальше. Первый респондент (далее Alex) запустил независимый аудит через своего AI-агента и нашёл следующее:

1. **Mutations без env-flag.** Деструктивные tools всегда advertise, клиент может auto-approve без явного gate на server side — это плохой default для альфа-инструмента.
2. **`asp_readFile` без секрет-фильтра.** В индексаторе мы фильтровали через `walker.ts`, но `read-file.ts` не использовал этот список — асимметрия защит.
3. **Symlink escape.** Наш `resolveSafe` сравнивал нормализованный путь, не canonical. Симлинки наружу могли pass.
4. **`.asp/` не в `.gitignore` пользователя.** Smoke test «грязнил» worktree — пользователю не должно приходиться помнить эту строку.
5. **npm audit warnings.** 1 critical + 3 high через `@xenova/transformers → protobufjs`. Не блокер runtime, но публичный сигнал недоверия.
6. **Архитектурный вопрос:** «зачем мутации в том же инструменте?» Разные surface, разный trust level — read-only consumer не должен иметь возможность auto-approve write.

Alex предложил конкретные fixes («ASP_ENABLE_MUTATIONS=1 gate, secret deny-list, realpath containment, .asp gitignore note, dependency audit cleanup»), что прямо превратилось в roadmap этого ADR.

Также Alex дал ссылку на ["The Harness Problem" (Can Atalay, 2026-02)](https://blog.can.ac/2026/02/12/the-harness-problem/) и его реализацию [opencode-hashline](https://github.com/izzzzzi/opencode-hashline) — обе работы про **архитектуру tool surface для агентов**. Этот lit-review мы пропустили в первом проходе и добавляем как отдельную запись.

## Decision

**Hardening pass v0.1.1.** Конкретные изменения:

### 1. Mutations gate

- Добавлен `ASP_ENABLE_MUTATIONS` env. По умолчанию **off**.
- `asp_writeFile` и `asp_applyPatch` вызывают `mutationsEnabled()` в начале и бросают `MutationsDisabledError` (`-32109`) с подсказкой как включить.
- Поле `capabilities.mutations` вычисляется один раз на старте сервера из env (не «динамически» в смысле re-evaluation per request — env не меняется после spawn).
- Tools всё равно advertise через `tools/list` — клиенты, которые проверяют `capabilities`, увидят пустой массив; клиенты, которые сразу зовут tool, получат внятную ошибку.
- Исключение: `asp_applyPatch({dryRun: true})` тоже gated — единообразие политики важнее лёгкого UX для dryRun.

### 2. Secret denylist (shared)

- Новый модуль `src/security.ts` экспортирует `SENSITIVE_BASENAME_PATTERNS` + `SENSITIVE_DIR_NAMES` + helper `pathHasSensitiveSegment`.
- `walker.ts`, `read-file.ts`, `list-files.ts` все импортируют отсюда — нет асимметрии.
- Покрытие: `.env*`, `*.pem`, `*.key`, `id_rsa/ed25519/dsa/ecdsa`, `credentials.json`, `service-account*.json`, `.netrc`, `.htpasswd`, `.pgpass`, `kubeconfig`, `aws_credentials`, `*.kdbx`, `*.gpg`, `*.p12`. Sensitive dirs: `.ssh`, `.aws`, `.gnupg`, `.gpg`, `.kube`.

### 3. Realpath-based containment

- `resolveSafe` теперь:
  1. Отказывает на абсолютные пути и `..`-escape.
  2. Применяет secret denylist.
  3. Канонизирует путь через `realpath`. Если файл не существует — поднимается до ближайшего существующего предка, канонизирует его, и сравнивает.
- Корень репо тоже realpath'ится при `setRepoRoot`.
- Симлинк внутри репо, указывающий на путь снаружи, теперь отклоняется с `PathForbiddenError` (`"Path resolves outside repo root via symlink"`).

### 4. Auto-gitignore

- При старте сервер вызывает `ensureGitignoreEntry(repoRoot)`.
- Если `.gitignore` существует и в нём нет `.asp/` — append.
- Если `.gitignore` не существует И `.git/` есть — создаём с `.asp/`.
- Если ни того ни другого — silent skip (не git-репо).
- Env-flag `ASP_SKIP_GITIGNORE=1` для пользователей, которые управляют ignore вручную.

### 5. Tests

Новый файл `tests/security.test.ts` (8 regression-тестов): readFile отказывает на секреты, listFiles опускает их, symlink escape блокируется, writeFile gated, mutationsEnabled accepts only `1`/`true`, и т.д.

Все 53 теста проходят за ~2 сек.

### 6. Default-off читательские tool — не делаем

Alex намекал, что асимметрия read vs write могла бы быть **разделение на два сервера** (`asp-ref-read` + `asp-ref-write`). Мы рассматриваем это и **откладываем**: env-flag — minimal viable fix. Сплит — отдельный ADR после получения второго пользовательского сигнала.

### 7. npm audit (mitigation, not fix)

`npm audit` показывает 4 уязвимости (3 high + 1 critical) транзитивно через `@xenova/transformers → onnxruntime-web → onnx-proto → protobufjs`. CVE-направление — потенциальный DoS через malformed protobuf. В нашем сценарии:

- Сервер локальный, protobuf принимаются только от собственного Hugging Face cache (доверенный источник).
- Эмбеддинги выключены по умолчанию (`ASP_ENABLE_EMBEDDINGS` тоже off).
- Network egress только на первой загрузке модели и опционально на Anthropic API.

**Decision:** не делаем `npm audit fix --force` (ломает ABI с `tree-sitter-wasms`). Документируем в `INTEGRATION.md` интерпретацию audit footprint. Альтернативно — `@xenova/transformers` → `@huggingface/transformers` (rebrand) когда rebrand release fix зависимости.

## Consequences

### Positive

- **Default install безопасно для подключения к live worktree.** Read-only, secrets отфильтрованы, симлинки не escape, индекс игнорится git'ом.
- **Outreach unblocked.** Можно с чистой совестью попросить Alex'а попробовать v0.1.1.
- **Конкретный demo нашего fix #5 (degradation)** — каждый отказ возвращает structured error, а не просто `EACCES`.
- **53 теста дают регрессионную защиту** на security-критичные пути.

### Negative

- **Mutations требуют opt-in.** Пользователи, которые хотят `asp_writeFile` работающим из коробки, будут жаловаться. Mitigation: чёткая подсказка в error message + QUICKSTART документация.
- **Realpath delay.** Каждый `resolveSafe` вызывает `realpathSync` на цепочке предков. На больших operations это может замедлять. Mitigation: realpath кэширован OS-уровнем; benchmarks не показали значимой разницы.
- **Auto-gitignore слегка surprise-y.** Сервер пишет в файл проекта без явного разрешения. Mitigation: `ASP_SKIP_GITIGNORE=1` для opt-out + сообщение в stderr.
- **`@xenova/transformers` audit warnings остаются.** Не блокеры, но шумят в `npm audit` users.

### Necessary follow-ups

- **Ответить Alex'у** v0.1.1 changelog с конкретным списком исправлений.
- **Обновить `INTEGRATION.md`, `QUICKSTART.md`** — упомянуть `ASP_ENABLE_MUTATIONS`, `.gitignore` auto-write, npm audit interpretation.
- **Spec v0.1.1 update** — Section 5.2 (capabilities) сделать `mutations` объяснимо динамическим. Section 9 (security) расширить с realpath + secret denylist mandatory.
- **`@huggingface/transformers` migration** когда они выпустят релиз с fixed deps (TBD timing).
- **ADR 0011 (потенциально):** разделение `asp-ref` на read/write серверы после второго пользовательского сигнала. Сейчас early — env-flag достаточен.

## Alternatives considered

### Alternative A: Server-side approval gate per operation

Каждый destructive call приостанавливает выполнение и ждёт явного approval (например, через MCP elicitation API). Отклонено: MCP elicitation мало где поддержан, увеличивает latency, не решает фундаментальную проблему (агент всё ещё может auto-approve). Env-flag — более чёткая граница.

### Alternative B: Сразу разделить на два MCP-сервера

`asp-ref-read` + `asp-ref-write` как отдельные npm packages с отдельными `.mcp.json` записями. Отклонено сейчас: преждевременная фрагментация архитектуры до того, как мы поняли, какие use cases реально требуют write. После большего количества user feedback — возможно.

### Alternative C: Принять status quo (mutations enabled by default)

Полагаться на client approval policy. Отклонено: Alex's audit показал, что это слишком слабая защита для альфа-инструмента, который пользователи будут пробовать на production коде.

## References

- [Lit-review: harness problem](../lit-review/atalay-2026-harness-problem.md) — новая запись, добавлена этим ADR.
- [ADR 0003](0003-reference-implementation-cleanroom-build-with-gitnexus-parity-5-fixes.md) — оригинальный scope reference impl.
- [ADR 0005](0005-outreach-deferred-gate-0-to-1-closes-without-user-commitments.md) — outreach стратегия, теперь validated.
- [opencode-hashline](https://github.com/izzzzzi/opencode-hashline) — практическая реализация read/write separation через naming heuristics.
- Alex's audit (внешний AI-агент через MCP) — first external security review, conducted 2026-05-22.
