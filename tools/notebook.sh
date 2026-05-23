#!/usr/bin/env bash
# Создать (если нет) запись лабораторного журнала на указанную дату.
# Использование: tools/notebook.sh <track-dir> <YYYY-MM-DD>

set -euo pipefail

TRACK_DIR="${1:?track dir required}"
DATE="${2:?date required}"
FILE="$TRACK_DIR/notebook/$DATE.md"

if [ -f "$FILE" ]; then
  echo "Запись уже существует: $FILE"
  exit 0
fi

mkdir -p "$(dirname "$FILE")"

cat > "$FILE" <<EOF
# $DATE

## Сделано

-

## Узнал

-

## Заблокировало

-

## Next step

-
EOF

echo "Создана запись: $FILE"
