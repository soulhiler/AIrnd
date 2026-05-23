# 0006. Reference implementation language — TypeScript

- **Дата:** 2026-05-21
- **Статус:** accepted
- **Связанные ADR:** [0003](0003-reference-implementation-cleanroom-build-with-gitnexus-parity-5-fixes.md) (reference impl scope)

## Простыми словами

Наш будущий ASP-сервер (`asp-ref`) надо на чём-то писать. Из вариантов рассмотрели четыре языка: **TypeScript, Python, Rust, Go**. Каждый имеет плюсы и минусы для нашей задачи.

Решение: **TypeScript**.

Главные причины:

1. **Официальный SDK для MCP** написан на TypeScript — мы избегаем переписывания обвязки, просто используем готовую.
2. **Большинство наших целевых пользователей (Cline, Continue.dev) — тоже TypeScript.** Они смогут изучить наш код одним языком.
3. **Низкая входная планка для контрибьюторов.** TypeScript знают больше людей, чем Rust.
4. **Достаточно быстрый для прототипа.** Производительность можно улучшить позже, если надо.

**Минус:** TypeScript медленнее Rust в разы. Если когда-нибудь окажется, что наш сервер не справляется на больших проектах — придётся переписать на Rust (Goose это сделал). Но это **будущая проблема**, не сегодняшняя.

## Context

ADR 0003 зафиксировал, что мы строим reference implementation (`asp-ref`). После закрытия lit-review (10/10 работ) появилась полная картина того, что писать, и можно выбирать язык.

Кандидаты:

- **TypeScript** — у Cline, Continue.dev. Официальный SDK для MCP (`@modelcontextprotocol/sdk`).
- **Python** — у Aider, GitNexus. Tree-sitter привязки хорошие.
- **Rust** — у Goose. Performance, но steep learning curve.
- **Go** — у SCIP. Сильная concurrency, но менее popular в AI-tools.

Главные факторы для выбора:

1. **MCP SDK availability.** Нам нужно как можно меньше boilerplate для MCP transport / lifecycle.
2. **Targeting OSS agent maintainers** (ADR 0002): Cline (TS), Continue (TS), Aider (Python), Goose (Rust), GitNexus (Python). TS — пересечение с двумя главными targets.
3. **Contributor accessibility.** Чем шире pool potential contributors, тем больше шанс external PR-ов после publication.
4. **Performance.** Должно быть «достаточно быстро» для индексации проектов 10k-100k LOC за разумное время.
5. **Tree-sitter bindings.** Любой serious AST parsing на 100+ языках требует tree-sitter — нужны качественные bindings.
6. **Storage backend interoperability.** Что мы выберем для storage (SQLite, LanceDB, Kùzu, custom) — должно работать с языком impl.

## Decision

**`asp-ref` пишется на TypeScript.**

Конкретно:

1. **Runtime:** Node.js 20+ LTS. Не Deno / Bun на старте — minimize surface area, Node — самый mature ecosystem.
2. **MCP integration:** `@modelcontextprotocol/sdk` (официальный TS SDK) для transport / lifecycle / message framing.
3. **AST parsing:** `web-tree-sitter` (tree-sitter WASM bindings) для language-agnostic parsing. Native bindings (`node-tree-sitter`) — если performance critical и WASM медленный.
4. **Storage backend:** TBD в отдельном ADR (после prototype Stage 2a). Кандидаты: SQLite (`better-sqlite3`), LanceDB (TS bindings exist), Kùzu (TS bindings exist).
5. **Build / packaging:** `tsc` + Node.js. Distribution через npm (`asp-ref` package), executable через `npx asp-ref`.
6. **Testing:** Vitest или Node's built-in `node:test`. Decision deferred.
7. **License:** Apache 2.0 (consistent с ADR 0002 / 0003).

## Consequences

### Positive

- **Минимальный boilerplate для MCP.** Официальный SDK = ~0 строк кода на transport. Сразу focus на ASP logic.
- **Cline / Continue ecosystem alignment.** Они смогут читать / contribut'ить наш код напрямую. **Boost для outreach.**
- **Большой contributor pool.** TS знают миллионы; Rust сотни тысяч.
- **npm distribution** — пользователь устанавливает `npx asp-ref` (как они уже привыкли с GitNexus: `npx gitnexus`). Familiar UX.
- **WASM tree-sitter portability** — наш сервер запускается на любой платформе с Node.js без native compilation.

### Negative

- **Performance hit vs Rust / Go.** На больших проектах (10M LOC) TS может быть в 5-10× медленнее. **Mitigation:**
  - Profile early, optimize hot paths (binary serialization, in-memory caches).
  - WASM offload (tree-sitter уже WASM).
  - Если станет blocker — миграция на Rust для core indexing, TS оставить для MCP layer (gRPC-like split).
- **Type system limits.** TypeScript types не sound (vs Rust's compile-time guarantees). Bugs могут escape через `any`. **Mitigation:** strict tsconfig, no `any` without justification, runtime validation на API boundaries (Zod).
- **Goose precedent in Rust** — мы расходимся с одним из major OSS agent. **Mitigation:** интероп через MCP (cross-language), не код-уровень.

### Necessary follow-ups

- **ADR 0007:** storage backend для `asp-ref` (SQLite vs LanceDB vs Kùzu vs custom). Решается после prototype Stage 2a experiments.
- **ADR 0008:** parser strategy (web-tree-sitter vs node-tree-sitter vs hybrid). Решается на основе performance bench Stage 2a.
- **ADR 0009:** packaging convention (`asp-ref` package vs separate `@asp/server` + `@asp/cli`). Решается позже.
- **`tracks/02-asp/prototype/`** обновить:
  - `package.json` skeleton с зависимостями (`@modelcontextprotocol/sdk`, `web-tree-sitter`).
  - `tsconfig.json` strict.
  - Updated README mention TypeScript choice.

## Alternatives considered

### Alternative A: Python

Pros: Aider / GitNexus в нашей экосистеме. Tree-sitter Python bindings mature. Easy contributing.

Cons:

- **No official MCP Python SDK** на момент решения. Есть community-maintained, но maintenance riskier.
- **Performance ниже TS** на server workloads (TS V8 vs Python interpreter; though Python has good async).
- **Distribution friction:** `pip install` менее universal than `npx` для CLI tools в Node-ecosystem agents.
- **Tooling fragmentation:** poetry vs pip vs uv vs hatch — больше choices, больше confusion для contributors.

Отклонено: minus на MCP SDK — критический.

### Alternative B: Rust

Pros: Goose precedent. Performance. Memory safety. Compile-time guarantees.

Cons:

- **Steep learning curve.** Меньше contributor pool. Risk: только мы можем contribut.
- **Slower iteration.** Compile time + lifetime / borrow checker eat productivity for early-stage research.
- **MCP Rust SDK** существует, но less mature than TS.
- **Premature optimization.** Performance может не быть bottleneck — Aider's Python RepoMap прекрасно работает на 45k★ adoption.

Отклонено: premature optimization principle. Может revisit для v2.0 если performance докажет critical.

### Alternative C: Go

Pros: SCIP в Go. Good concurrency. Single binary distribution.

Cons:

- **Меньше presence в AI-tools space.** No SCIP-like rationale (SCIP is data format, не agent).
- **Tree-sitter Go bindings** менее mature than TS / Python.
- **No mature MCP Go SDK** (как minimum в 2026-05).

Отклонено: ни одного strong reason ввыбрать поверх TS.

### Alternative D: Multi-language (Rust core + TS wrapper)

Хитрая опция: tree-sitter & indexing на Rust (FFI), MCP layer на TS.

Pros: best of both worlds — performance + ecosystem.

Cons:

- **Build complexity** — два toolchain, FFI bindings, cross-compilation.
- **Premature** для Stage 2a (MVP-альфа). Можно адопт в Stage 2c или v2.
- **Increased contributor barrier** — нужно знать оба языка.

Отклонено сейчас, может revisit для v2.0.

## References

- **MCP SDK:** <https://github.com/modelcontextprotocol/typescript-sdk>.
- **web-tree-sitter:** <https://www.npmjs.com/package/web-tree-sitter>.
- **Cline source:** TypeScript 97.7% — confirms ecosystem alignment.
- **Continue.dev source:** TypeScript 84.4% — confirms ecosystem alignment.
- **Goose source:** Rust 50.2% — precedent для Alternative B.
- **GitNexus source:** TypeScript 81.5% — confirms TS viable для production code intelligence в этом scope. (GitNexus уже на TS — это **valuable proof of concept**, что TS можно использовать для serious code intelligence.)
- **ADR 0003:** reference impl scope.

## Open items / nepostavivshiesya отложены

- Detailed package layout (`packages/server`, `packages/cli`, monorepo vs single?) — решается ближе к coding.
- Async runtime detail (Node native vs Bun) — решается на старте кодинга.
- CI / testing framework — решается на старте кодинга.
