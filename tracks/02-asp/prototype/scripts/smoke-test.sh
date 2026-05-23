#!/usr/bin/env bash
#
# asp-ref smoke test. Verifies that a freshly-built asp-ref MCP server
# answers the basic JSON-RPC handshake and exposes its operations.
#
# Usage: ./scripts/smoke-test.sh [repo-root]
#   repo-root defaults to the parent of this script's prototype directory.
#
set -euo pipefail

cd "$(dirname "$0")/.."

REPO_ROOT="${1:-$(cd ../../.. && pwd)}"
SERVER=dist/server.js

GREEN='\033[0;32m'
RED='\033[0;31m'
RESET='\033[0m'

ok() {
  printf "${GREEN}OK${RESET} %s\n" "$1"
}
fail() {
  printf "${RED}FAIL${RESET} %s\n" "$1"
  if [ -n "${2:-}" ]; then
    printf "  payload: %s\n" "$2"
  fi
  exit 1
}

# Run a single JSON-RPC payload against the server and return its stdout.
# We send all our messages in one batch (line-delimited JSON) and let the
# server exit when stdin closes.
run_rpc() {
  local payload="$1"
  printf "%s\n" "$payload" | node "$SERVER" "$REPO_ROOT" 2>/dev/null
}

# Convenience: pipe several messages through the server in one session
# (server stays alive until EOF, replies are one-per-line).
run_session() {
  printf "%s\n" "$@" | node "$SERVER" "$REPO_ROOT" 2>/dev/null
}

step() {
  printf "%-6s %-44s " "$1" "$2"
}

# 1/6: build artifacts present
step "1/6" "Build artifacts present"
if [ -f "$SERVER" ]; then
  ok ""
else
  fail "$SERVER not found — run 'npm install && npm run build' first"
fi

# Compose payloads.
INIT='{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"smoke-test","version":"1.0"}},"id":1}'
LIST='{"jsonrpc":"2.0","method":"tools/list","params":{},"id":2}'
CAPS='{"jsonrpc":"2.0","method":"tools/call","params":{"name":"asp_capabilities","arguments":{}},"id":3}'
LSF='{"jsonrpc":"2.0","method":"tools/call","params":{"name":"asp_listFiles","arguments":{"path":".","recursive":false}},"id":4}'
REFRESH='{"jsonrpc":"2.0","method":"tools/call","params":{"name":"asp_refresh","arguments":{"wait":true}},"id":5}'
SEARCH='{"jsonrpc":"2.0","method":"tools/call","params":{"name":"asp_searchFiles","arguments":{"query":"asp","limit":3}},"id":6}'

OUTPUT="$(run_session "$INIT" "$LIST" "$CAPS" "$LSF" "$REFRESH" "$SEARCH" || true)"

if [ -z "$OUTPUT" ]; then
  fail "Server produced no output. Check 'node $SERVER $REPO_ROOT' manually."
fi

# 2/6: initialize handshake
step "2/6" "Initialize handshake"
if printf "%s\n" "$OUTPUT" | grep -q '"id":1' \
   && printf "%s\n" "$OUTPUT" | grep -q '"protocolVersion"'; then
  ok ""
else
  fail "initialize did not return protocolVersion" "$OUTPUT"
fi

# 3/6: tools/list returns N tools
step "3/6" "tools/list returns N tools"
TOOL_COUNT=$(printf "%s\n" "$OUTPUT" | grep -o '"name":"asp_[^"]*"' | sort -u | wc -l | tr -d ' ')
if [ "$TOOL_COUNT" -ge 10 ]; then
  ok "($TOOL_COUNT)"
else
  fail "expected ≥10 tools, got $TOOL_COUNT" "$OUTPUT"
fi

# 4/6: asp_capabilities returns tier 2
step "4/6" "asp_capabilities returns tier 2"
if printf "%s\n" "$OUTPUT" | grep -q '"tier": 2' \
   || printf "%s\n" "$OUTPUT" | grep -q '\\"tier\\": 2'; then
  ok ""
else
  fail "tier 2 not advertised in capabilities" "$OUTPUT"
fi

# 5/6: asp_listFiles returns repo entries
step "5/6" "asp_listFiles returns repo entries"
LIST_HIT=$(printf "%s\n" "$OUTPUT" | grep -o '"path":' | wc -l | tr -d ' ')
if [ "$LIST_HIT" -ge 1 ]; then
  ok "($LIST_HIT entries seen)"
else
  fail "asp_listFiles returned no entries" "$OUTPUT"
fi

# 6/6: asp_searchFiles indexes and finds at least one hit. matches arrive
# nested inside MCP `content.text`, so the `"symbolId":` substring appears
# JSON-escaped on the wire (`\"symbolId\":`). Search for either form.
step "6/6" "asp_searchFiles indexes and finds"
MATCH_HIT=$(printf "%s\n" "$OUTPUT" | grep -o 'symbolId' | wc -l | tr -d ' ')
if [ "$MATCH_HIT" -ge 1 ]; then
  ok "($MATCH_HIT matches)"
else
  fail "asp_searchFiles returned no matches" "$OUTPUT"
fi

printf "\n${GREEN}✓ asp-ref smoke test PASSED${RESET}\n"
