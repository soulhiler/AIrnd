SHELL := /bin/bash

TRACK ?= 02-asp
TRACK_DIR := tracks/$(TRACK)
TODAY := $(shell date +%Y-%m-%d)

.DEFAULT_GOAL := help

.PHONY: help notebook lit-add adr-new phase-status lint check

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
		npx --yes markdownlint-cli2 "**/*.md" "#node_modules" "#docs/TZ/**"; \
	else \
		echo "npx не найден — пропускаю lint. Установите Node.js."; \
	fi

check: ## Проверка структуры репозитория
	@echo "=== Структура треков ==="
	@find tracks -maxdepth 3 -type d | sort
	@echo ""
	@echo "=== Текущая фаза $(TRACK) ==="
	@head -20 "$(TRACK_DIR)/README.md"
