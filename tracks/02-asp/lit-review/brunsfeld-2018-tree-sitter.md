# Tree-sitter — Incremental Parsing System

## Metadata

- **Authors:** Max Brunsfeld (изначально GitHub/Atom), сейчас сообщество
- **Year:** 2018 (Strange Loop доклад), активное развитие до сих пор
- **Venue:** Open source, доклад на Strange Loop 2018
- **arXiv / DOI:** —
- **Link:** <https://tree-sitter.github.io> | <https://github.com/tree-sitter/tree-sitter>
- **Citation key:** brunsfeld-2018-tree-sitter
- **Дата прочтения:** 2026-05-21
- **Relevance (1–5):** 4
- **Tags:** parsing, ast, tool, foundation, must-read, engineering

## TL;DR

Tree-sitter — incremental parser generator + runtime для построения синтаксических деревьев исходного кода. Спроектирован под три требования: достаточно общий для любого языка (GLR-парсинг), достаточно быстрый для парсинга на каждое нажатие клавиши (incremental + С-runtime), достаточно устойчивый к ошибкам (error recovery). Стандарт де-факто в современных редакторах (Neovim, Helix, Zed) и инструментах LLM-агентов.

## Key claims

- **Goals:** «General enough to parse any programming language. Fast enough to parse on every keystroke. Robust enough to provide useful results even in the presence of syntax errors. Dependency-free, runtime is pure C».
- **Алгоритм:** GLR (Generalized LR) — форкает parse stack для каждой неоднозначности, что позволяет писать грамматики «почти любого» языка без ручной дизамбигуации.
- **Incremental:** «Incremental parsing marks nodes in the old tree where text was modified, then parses the file again, reusing nodes that were not marked».
- **Query system:** built-in S-expression query language для поиска по AST. Используется для синтаксической подсветки, навигации, code intelligence.

## Methodology

Tree-sitter — инженерный проект, не исследовательский. Метод:

1. Парсер-генератор берёт грамматику (JavaScript DSL), компилирует в C.
2. Runtime использует сгенерированные таблицы для парсинга.
3. Incremental edits сохраняют поддеревья, не затронутые правкой.
4. Queries (`.scm` S-expression файлы) — декларативный поиск по AST.

Привязки: Rust, JavaScript, Python, Ruby, Go, Java, Swift, Kotlin, WASM, CLI.

## Что tree-sitter даёт ASP

Tree-sitter — **естественный foundation для индексера ASP-сервера** на Фазе 2:

1. **AST как структурированный примитив.** Семантические операции ASP (find references, dependency query) могут опираться на AST вместо плоских регулярок.
2. **Incremental updates.** Когда файл меняется, не нужно реиндексировать всё — это критично для большого проекта.
3. **Multi-language через один интерфейс.** Tree-sitter поддерживает 200+ языков с одной API. ASP-сервер потенциально может работать с любым из них без специфичного кода.
4. **Query language.** Можно описать «найти все вызовы функции X» как `.scm` query, без императивного обхода AST.
5. **Error tolerance.** Агент часто работает с «сломанным» кодом (промежуточные состояния правок). Tree-sitter возвращает осмысленный AST даже на синтаксических ошибках.

## Gap (для нашего трека)

Ограничения tree-sitter, которые ASP должен компенсировать:

1. **Shallow AST — нет name resolution.** Tree-sitter не разрешает имена в области видимости. `foo()` в AST — это просто identifier `foo` + call. Чтобы знать, **какая** `foo` имеется в виду, нужен дополнительный пласт (Stack Graphs от GitHub, semantic-сервис, или собственный resolver).
2. **Нет type information.** Tree-sitter — синтаксический парсер, не тайп-чекер. Type-aware операции (impact analysis по типу) требуют интеграции с language-specific анализатором.
3. **Cross-file ничего не знает.** Один файл = одно дерево. Cross-file dependencies строятся поверх.
4. **Query language — синтаксический, не семантический.** `.scm` queries ищут по структуре AST, не по семантике.

То есть tree-sitter — **необходимый, но не достаточный** компонент ASP-сервера. Сверху нужен:

- Symbol table / scope resolver.
- Cross-file index.
- Возможно — интеграция с LSP-серверами целевых языков для type information.

## Open questions

- Какие готовые решения для name resolution поверх tree-sitter? (Stack Graphs от GitHub — кандидат, надо изучить.)
- Можно ли использовать tree-sitter queries как primitives ASP-операций, или нужен свой query language?
- Какие edge-cases (template languages, macros, dynamic imports) ломают tree-sitter?
- Sourcegraph SCIP / LSIF — альтернативные индексы. Где их граница с tree-sitter?

## Related work cited

- **Stack Graphs (GitHub)** — name resolution поверх tree-sitter. Прямой кандидат для интеграции.
- **SCIP / LSIF (Sourcegraph)** — стандарты code index, могут быть альтернативой или дополнением.
- **Zed editor** — современный пример tree-sitter в production для LLM-агентов; их blog post «Enabling low-latency, syntax-aware editing» — must-read.
- **TreeShaper, Stack Graphs paper** — если есть формальная работа от GitHub Research.

## Личные заметки

Tree-sitter не вносит вклад в **архитектурный** дизайн ASP, но определяет **инженерные** ограничения:

- Если ASP-сервер использует tree-sitter — мы получаем «бесплатно» multi-language, incremental, error-tolerant парсинг.
- Если не использует — нужно либо писать свой парсер (нереально), либо опираться на LSP-серверы каждого языка (тоже сложно).

**Дефолтный выбор:** tree-sitter как foundation на Фазе 2, плюс Stack Graphs для name resolution. Это фиксируется ADR позже, на Фазе 1, когда выбор станет конкретным.

Side note: tree-sitter уже широко используется в LLM-агентах (Aider, Continue) — это даёт нам **общий язык** с потенциальными adopter-ами ASP.
