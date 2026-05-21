SHELL := /bin/bash

TRACK ?= 02-asp
TRACK_DIR := tracks/$(TRACK)
TODAY := $(shell date +%Y-%m-%d)

.DEFAULT_GOAL := help

.PHONY: help notebook lit-add adr-new phase-status lint check index gn-status gn-context gn-impact gn-query gn-clean

help: ## Показать список команд
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

notebook: ## Открыть/создать запись журнала на сегодня (TRACK=02-asp)
	@tools/notebook.sh "$(TRACK_DIR)" "$(TODAY)"

lit-add: ## Создать запись литобзора. Использование: make lit-add SLUG=lsp-spec
	@if [ -z "$(SLUG)" ]; then echo "Usage: make lit-add SLUG=<short-slug>"; exit 1; fi
	@tools/lit-add.sh "$(TRACK_DIR)" "$(SLUG)"

adr-new: ## Создать новую ADR. Использование: make adr-new TITLE="Decision title"
	@if [ -z "$(TITLE)" ]; then echo 'Usage: make adr-new TITLE="<title>"'; exit 1; fi
	@tools/adr-new.sh "$(TRACK_DIR)" "$(TITLE)"

phase-status: ## Показать gate-чеклист текущей фазы
	@awk '/^## Gate/,/^---$$/' "$(TRACK_DIR)/README.md" | sed '/^---$$/d'

lint: ## Markdown lint (требует npx и сеть)
	@if command -v npx >/dev/null 2>&1; then \
		npx --yes markdownlint-cli2 "**/*.md" "#**/node_modules/**" "#docs/TZ/**" "#.claude/skills/**" "#**/dist/**"; \
	else \
		echo "npx не найден — пропускаю lint. Установите Node.js."; \
	fi

check: ## Проверка структуры репозитория
	@echo "=== Структура треков ==="
	@find tracks -maxdepth 3 -type d | sort
	@echo ""
	@echo "=== Текущая фаза $(TRACK) ==="
	@head -20 "$(TRACK_DIR)/README.md"

# --- GitNexus (code intelligence; prior art Трека 2 + dogfood tool) ---

index: ## Полная переиндексация репо в GitNexus
	@npx --yes gitnexus analyze .

gn-status: ## Свежесть индекса GitNexus
	@npx --yes gitnexus status

gn-context: ## Контекст символа. Использование: make gn-context NAME=ClassName
	@if [ -z "$(NAME)" ]; then echo "Usage: make gn-context NAME=<symbol>"; exit 1; fi
	@npx --yes gitnexus context "$(NAME)"

gn-impact: ## Blast radius. Использование: make gn-impact TARGET=symbolName
	@if [ -z "$(TARGET)" ]; then echo "Usage: make gn-impact TARGET=<symbol>"; exit 1; fi
	@npx --yes gitnexus impact "$(TARGET)"

gn-query: ## Hybrid search. Использование: make gn-query Q="концепт"
	@if [ -z "$(Q)" ]; then echo 'Usage: make gn-query Q="<query>"'; exit 1; fi
	@npx --yes gitnexus query "$(Q)"

gn-clean: ## Удалить индекс GitNexus
	@npx --yes gitnexus clean --yes
