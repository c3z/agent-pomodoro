#!/bin/bash
# Claude Code hook — sends heartbeat to Agent Pomodoro on session start
# Configure: Add APOM_API_KEY to environment, set APOM_CONVEX_URL

API_KEY="${APOM_API_KEY}"
CONVEX_URL="${APOM_CONVEX_URL:-https://efficient-wolf-51.eu-west-1.convex.site}"

if [ -z "$API_KEY" ]; then
  exit 0
fi

(
  curl -s --max-time 5 \
    -X POST \
    -H "Authorization: Bearer $API_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"source\":\"claude-code\"}" \
    "$CONVEX_URL/api/activity/heartbeat" \
    2>/dev/null
) &
disown
