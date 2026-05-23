# Outreach draft — OSS agent maintainers

- **Дата создания:** 2026-05-22
- **Статус:** draft (готов к отправке после финальной проверки)
- **Связанные ADR:** [0002](../decisions/0002-asp-scope-opensource-agent-ecosystem-only.md), [0005](../decisions/0005-outreach-deferred-gate-0-to-1-closes-without-user-commitments.md)

## Простыми словами

Чтобы закрыть Gate 1 → 2, нужно связаться с создателями главных бесплатных AI-помощников и попросить их попробовать наш стандарт ASP + рабочий сервер `asp-ref`. Этот файл — **черновики писем** для каждого приоритетного maintainerа.

**Стратегия:**

1. **Public-first.** Создаём GitHub Discussion / Issue в их репо, не private email. Это держит обсуждение открытым.
2. **Concrete artifact.** Каждое письмо указывает на (а) спеку ASP v0.1, (б) рабочий `asp-ref` сервер с инструкцией установки в `.cline/mcp.json` / `.goose/...`.
3. **Specific ask.** Не «попробуйте» — а «можем ли мы добавить пример конфига в ваш docs/, чтобы пользователи попробовали?».
4. **No pressure.** Если no — спасибо за внимание и продолжаем.

**Приоритеты по ADR 0002** (в порядке убывания adoption signal):

1. Cline (62.1k★) — Saoud Rizwan.
2. Goose (45.6k★) — Linux Foundation Agentic AI Foundation.
3. Aider (45.1k★) — Paul Gauthier.
4. Continue.dev (33.3k★) — Continue Dev, Inc.
5. GitNexus (39.5k★) — Abhigyan Patwari (**private heads-up**, не public — он критический stakeholder и заслуживает первого слова до общего release).

## 1. Cline (priority #1)

**Channel:** GitHub Discussion в `cline/cline` (категория "Show and tell" или "Ideas") + cross-post в их Discord если активен.

**Title:** *ASP: an open spec for MCP-based code intelligence servers (with reference impl)*

**Body:**

> Hi Saoud and Cline maintainers,
>
> I'm working on an open RFC called **ASP (Agent Server Protocol)** — a thin layer on top of MCP that standardises the typed operations a code-intelligence server exposes to coding agents (read/search files, find symbols by hierarchical tag, retrieve with vector/keyword/hybrid, impact analysis, mutations).
>
> The motivation is N×M: every OSS agent currently reimplements file navigation, search, and ranking. ASP gives serverов a single contract so a server written for Cline works in Goose, Aider, etc. unchanged.
>
> What's ready:
> - **Spec v0.1 draft** (~1500 lines, 12 operations + capability negotiation + hierarchical tag schema): [link to design/03-asp-spec-draft.md]
> - **`asp-ref` reference implementation** (Apache 2.0, TypeScript, ~3400 LOC): <https://github.com/soulhiler/AIrnd/tree/main/tracks/02-asp/prototype>
> - Tier 2 features: SQLite FTS5 (offline-first), hierarchical tags, vector embeddings via `@xenova/transformers`, RRF hybrid, best-effort symbol graph, unified-diff mutations.
> - 12 supported languages via tree-sitter WASM (no native build tools).
> - Drop-in `.cline/mcp.json` config:
>
>   ```json
>   { "mcpServers": { "asp-ref": { "command": "npx", "args": ["asp-ref"] } } }
>   ```
>
> What I'm asking:
> 1. **5-minute look** at the spec — any obvious mismatches with how Cline thinks about code intelligence?
> 2. **Optional**: I'd love to add an `asp-ref` example to your MCP marketplace docs once we've validated the integration end-to-end. Happy to PR.
> 3. **Sampling capability** — ASP's LLM rerank prefers MCP sampling. If Cline already advertises sampling we should be plug-and-play; if not, would you consider it?
>
> Not asking for endorsement, code review, or production buy-in — just a sanity check from someone whose project is one of the primary intended users. If this isn't relevant for Cline's roadmap, no worries and thanks for reading.
>
> Repo for full context: <https://github.com/soulhiler/AIrnd>
>
> — soulhiler (AIrnd Track 2)

## 2. Goose (priority #2)

**Channel:** GitHub Discussion в `block/goose` (or new repo after AAIF transfer) + Goose Discord.

**Title:** *Adding ASP — an open code-intelligence protocol — as a Goose extension*

**Body (slightly different framing — Goose is extension-first):**

> Hi Goose / AAIF maintainers,
>
> I noticed Goose's MCP extension framework is essentially designed for what I'm building: an open spec for code-intelligence MCP servers. The spec is called **ASP (Agent Server Protocol)** — Apache 2.0, sits on top of MCP, standardises the typed operations a code-intelligence server exposes.
>
> What's relevant to Goose:
> - `asp-ref` is a drop-in MCP extension. Install via `npx asp-ref`.
> - 12 operations covering read/search/tag/context/retrieve/impact/mutations.
> - 12 languages, offline-first, no API keys required for the baseline.
> - Spec v0.1: [link]
> - Source: <https://github.com/soulhiler/AIrnd/tree/main/tracks/02-asp/prototype>
>
> Given Goose's reputation for "shaping MCP" (Arcade.dev's history article), I'd value your read on the spec — especially around how we framed `safetyClass` per operation (Plan / Act-style separation) and the `tagSchema` capability negotiation. Both were inspired by patterns Goose helped popularise.
>
> Same ask as Cline: 5-minute look + tell me if anything's obviously wrong. Optional: a one-line entry in your extensions list once we've validated.
>
> — soulhiler (AIrnd Track 2)

## 3. Aider (priority #3)

**Channel:** GitHub Discussion в `Aider-AI/aider`.

**Title:** *Building on RepoMap: ASP — open spec for code-intelligence servers (token budget as first-class)*

**Body (token budget is the angle — Paul invented this):**

> Hi Paul,
>
> Aider RepoMap's enforced token budget — the way every retrieval is bounded by a hard ceiling rather than returning whatever and letting the prompt overflow — is one of the strongest patterns in the OSS coding-agent space. It's literally a core principle of the open spec I'm drafting: **ASP** (Agent Server Protocol), Apache 2.0.
>
> ASP formalises hierarchical tags, capability negotiation, and token-budget-aware operations across an MCP-shaped surface. The reference implementation `asp-ref` re-implements the budget binary-search pattern from RepoMap. Aider could use it as a server-side complement: send `asp/retrieve` a query, get back a hierarchically-tagged, budget-bound symbol list ready for prompt context — without RepoMap re-doing it.
>
> What's ready:
> - Spec v0.1: [link]
> - asp-ref TypeScript MCP server (no native build): <https://github.com/soulhiler/AIrnd/tree/main/tracks/02-asp/prototype>
>
> The ask is the same — 5-minute look at the spec, especially the `tokenBudget` semantics in Section 3.6 and the `asp/retrieve` operation. Does it match how you think about RepoMap's output? Did I get the binary search story wrong anywhere?
>
> Aider's an explicit citation in our literature review; full context: <https://github.com/soulhiler/AIrnd/blob/main/tracks/02-asp/lit-review/gauthier-2024-aider-repomap.md>
>
> Thanks for everything RepoMap.
>
> — soulhiler (AIrnd Track 2)

## 4. Continue.dev (priority #4)

**Channel:** GitHub Discussion в `continuedev/continue`.

**Title:** *ASP: code-intelligence protocol with vector/keyword/hybrid retrieval — complements your @Codebase*

**Body:**

> Hi Continue team,
>
> ASP (Agent Server Protocol) is an open spec for code-intelligence MCP servers. It standardises two-stage retrieval — exactly the `nRetrieve` / `nFinal` / rerank pattern your @Codebase context provider uses.
>
> The reference implementation `asp-ref` (Apache 2.0, TypeScript) supports:
> - `vector` mode (local `@xenova/transformers` embeddings — same library you use)
> - `keyword` mode (SQLite FTS5)
> - `hybrid` mode (Reciprocal Rank Fusion)
> - Optional LLM rerank via MCP sampling or `ANTHROPIC_API_KEY` fallback
>
> Continue could use `asp-ref` as a swap-in `@Codebase` backend that's portable across agents (Cline, Goose, etc. as well), if that's interesting. Or — more relevant — your team's feedback on the spec would help us avoid landmines you've already hit.
>
> Spec v0.1: [link]
> Source: <https://github.com/soulhiler/AIrnd/tree/main/tracks/02-asp/prototype>
> Continue is cited in our lit-review: <https://github.com/soulhiler/AIrnd/blob/main/tracks/02-asp/lit-review/continuedev-2026-codebase-indexing.md>
>
> Same ask: 5-minute look + feedback.
>
> — soulhiler (AIrnd Track 2)

## 5. GitNexus — private heads-up (priority #5)

**Channel:** Private email or DM to Abhigyan Patwari (whichever contact is on his GitHub profile). **Not** public until he's had time to respond.

**Subject:** *Heads up before publishing — ASP draft cites GitNexus extensively*

**Body:**

> Hi Abhigyan,
>
> Quick heads-up before I publish anything: I've been drafting an open RFC called **ASP (Agent Server Protocol)** — and GitNexus is the dominant prior art it builds on. Your project showed me the shape of the problem; the spec wouldn't exist without it. Full lit-review entry here for transparency: <https://github.com/soulhiler/AIrnd/blob/main/tracks/02-asp/lit-review/patwari-2026-gitnexus.md>
>
> What ASP is:
> - Open RFC (Apache 2.0) for code-intelligence MCP servers.
> - Standardises hierarchical tags, capability negotiation, token-budget semantics, mutations, and graph-based impact — all of which GitNexus inspired.
> - **Doesn't** fork or copy GitNexus code (license-compatible would mean PolyForm Noncommercial, which doesn't fit our OSS-agent target audience — that's documented in ADR 0002).
> - Has a small Apache-2.0 reference implementation (`asp-ref`, TypeScript, ~3400 LOC) that re-implements 12 of GitNexus's 16 MCP tools as **clean-room** code under permissive license.
>
> Things I'd like your input on, before this becomes public:
> 1. Is the GitNexus lit-review entry fair? Anything I got wrong or missed?
> 2. The 5 UX gaps I identified (offline-first FTS, fuzzy symbol lookup, query-language standardisation, opt-in instrumentation, explicit degradation) — are any of those things you're actively addressing in GitNexus's roadmap? If yes, I'd love to align rather than parallel-track.
> 3. Would you be interested in being listed as a co-author or contributor on the spec? You're the main person whose work this builds on, and I want to be explicit about that.
>
> Happy to chat on a call or in writing, whichever you prefer.
>
> Repository: <https://github.com/soulhiler/AIrnd>
>
> Thanks for everything GitNexus.
>
> — soulhiler (AIrnd Track 2)

## v0.1.1 reply template (для Alex и всех, кто прислал security feedback)

Когда читатель прислал audit, ответ должен быть:

> Спасибо, прямо в точку. Закрыл все 5:
>
> 1. **Mutations off by default.** Теперь `ASP_ENABLE_MUTATIONS=1`
>    требуется явно. `asp_writeFile` / `asp_applyPatch` возвращают
>    `MutationsDisabledError` (`-32109`) без него. Capability
>    `mutations` динамически отражает gate.
> 2. **Secret denylist в `asp_readFile` / `asp_listFiles`.** Раньше
>    индексатор фильтровал, read нет — асимметрия закрыта через общий
>    `src/security.ts` модуль. Покрытие: `.env*`, `*.pem`, `*.key`,
>    `id_rsa/ed25519/dsa/ecdsa`, `credentials.json`, `service-account*`,
>    `.netrc`, `.htpasswd`, `.pgpass`, `kubeconfig`, `aws_credentials`,
>    `*.kdbx`, `*.gpg`, `*.p12`. Sensitive dirs: `.ssh`, `.aws`,
>    `.gnupg`, `.gpg`, `.kube`.
> 3. **Realpath containment.** `resolveSafe` теперь canonicalises
>    через `realpath`, поднимаясь до ближайшего существующего предка
>    для несуществующих destinations (writeFile создаёт новый файл).
>    Symlink escape блокируется с
>    `"Path resolves outside repo root via symlink"`.
> 4. **`.asp/` auto-gitignore.** Сервер на startup добавляет `.asp/`
>    в `.gitignore` (если git-репо). Disable: `ASP_SKIP_GITIGNORE=1`.
> 5. **npm audit:** 4 vulns остаются transitively через
>    `@xenova/transformers → onnx-proto → protobufjs`. Mitigated:
>    эмбеддинги off by default, сервер локальный, protobuf consume
>    только из доверенного HF cache. `--force` ломает ABI с
>    tree-sitter-wasms; жду `@huggingface/transformers` rebrand
>    release для миграции. Документировано в `INTEGRATION.md`.
>
> Plus добавил твою ссылку на harness-problem в lit-review (мы её
> пропустили в первом проходе). Atalay'a thesis convergent с нашим
> новым ADR 0010 — read/write separation. В v0.1.2 планирую adopt
> hashline pattern для `asp_applyPatch` (FNV-1a `fileRev` parameter).
>
> 8 new regression-тестов гарантируют, что ничего из этого не
> регрессирует: secret denylist, symlink escape, mutations gate.
> Все 53 теста зелёные.
>
> Готово к повторной попытке? `cd asp-ref && git pull && npm install
> && npm run build && ./scripts/smoke-test.sh /tmp/sanitized-copy`.
> Если что-то ещё всплывёт — буду рад второму раунду.

## Tracking

| Recipient | Channel | Sent | Reply | Status |
|---|---|---|---|---|
| Cline (Saoud Rizwan) | GitHub Discussion | 🚧 | — | not sent |
| Goose (AAIF) | GitHub Discussion | 🚧 | — | not sent |
| Aider (Paul Gauthier) | GitHub Discussion | 🚧 | — | not sent |
| Continue.dev | GitHub Discussion | 🚧 | — | not sent |
| GitNexus (Patwari) | Private | 🚧 | — | not sent |

**Gate 1 → 2 criterion:** ≥3 recipients respond positively (verbal commit, code review, or PR). Update tracking table as replies come in.
