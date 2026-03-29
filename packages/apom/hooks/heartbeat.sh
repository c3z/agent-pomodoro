#!/bin/bash
# Claude Code hook — sends heartbeat to Agent Pomodoro on session start
# Configure: Add APOM_API_KEY to environment, set APOM_CONVEX_URL
# Throttled: max 1 heartbeat per 5 minutes to stay within Convex free tier

API_KEY="${APOM_API_KEY}"
CONVEX_URL="${APOM_CONVEX_URL:-https://efficient-wolf-51.eu-west-1.convex.site}"

if [ -z "$API_KEY" ]; then
  exit 0
fi

# Throttle: skip if last heartbeat was less than 5 minutes ago
LOCKFILE="/tmp/apom-heartbeat.lock"
if [ -f "$LOCKFILE" ]; then
  LOCK_AGE=$(( $(date +%s) - $(stat -f%m "$LOCKFILE" 2>/dev/null || stat -c%Y "$LOCKFILE" 2>/dev/null || echo 0) ))
  if [ "$LOCK_AGE" -lt 300 ]; then
    exit 0
  fi
fi
touch "$LOCKFILE"

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
