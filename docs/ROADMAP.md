# Agent Pomodoro — Roadmap

> Cel aplikacji: nie zmusić się do pracy, ale zmusić się do **używania pomodoro PODCZAS pracy z Claude Code**.
> Penalizacja za pracę bez timera. Agent (Atropa) monitoruje i egzekwuje dyscyplinę.

---

## Phase 4: v1.0 Polish & Agent Control Loop

### Sprint #16 — Core UX Fix + Agent API Hardening

**Goal:** Naprawić najgorszą bolączkę (utrata timera) i zamknąć krytyczne luki w agent API.

| # | Item | Impact | Effort | Details |
|---|------|--------|--------|---------|
| 1 | Timer state persistence (localStorage) | 5 | S | Timer gubi stan przy nawigacji. Fix: snapshot `{ endTime, mode, sessionId }` w localStorage, hydrate on mount. ~30 linii w `Timer.tsx`. |
| 2 | `GET /api/sessions/active` endpoint | 5 | S | Agent nie ma jak sprawdzić czy sesja biegnie. Query `sessions.activeSession` istnieje — brakuje HTTP wrappera + `apom active` CLI command. |
| 3 | Idempotency guard na `POST /api/sessions/start` | 4 | S | Dwa requesty startowe = dwie sesje. Zwracać 409 z istniejącym sessionId jeśli aktywna sesja już istnieje. |

---

### Sprint #17 — Settings & Personalization

**Goal:** Pozwolić użytkownikowi dostosować app do swojego rytmu pracy.

| # | Item | Impact | Effort | Details |
|---|------|--------|--------|---------|
| 1 | Custom timer durations | 4 | S | `DEFAULT_CONFIG` w `Timer.tsx:14-19` jest hardcoded. Dodać formularz w Settings (work/break/longBreak minuty), store w localStorage. |
| 2 | Configurable workday hours | 4 | M | `WORK_START_HOUR=9, WORK_END_HOUR=18` hardcoded w `accountability.ts:54-55`. Dodać do Settings, przekazywać do `computeAccountability()`. |
| 3 | Sound & vibration mute toggle | 3 | S | `sounds.ts` nie ma flagi mute. Dodać toggle w Settings, store w localStorage. Respektować w `playCompletionSound`, `playStartSound`, `playResetSound`. |

---

### Sprint #18 — Nav & Indicators

**Goal:** Nigdy nie zgubić kontekstu sesji, niezależnie od strony.

| # | Item | Impact | Effort | Details |
|---|------|--------|--------|---------|
| 1 | Active session indicator w nav | 4 | S | Mała pilulka "25:00 ●" w `layout.tsx` nav, używając `activeSession` query. Widoczna na każdej stronie. |
| 2 | Accountability score na dashboard (prominentnie) | 4 | S | Duża litera grade (S/A/B/C/F) na home.tsx, nie ukryta w badge. Shame score jako first thing visible. |
| 3 | Timeline time cursor | 3 | S | Cienka pionowa linia "teraz" na accountability timeline bar. 5 linii CSS. |

---

### Sprint #19 — Agent Proactive Loop

**Goal:** Atropa automatycznie zarządza sesje, nie tylko obserwuje.

| # | Item | Impact | Effort | Details |
|---|------|--------|--------|---------|
| 1 | Auto-start pomodoro at conversation start | 5 | S | Skill/CLAUDE.md change: Atropa startuje pomodoro na początku konwersacji jeśli nie ma aktywnej sesji. Wymaga idempotency guard z #16. |
| 2 | Agent-settable current task | 5 | M | Nowy field `currentTask?: string` na `pomodoroSessions`. `POST /api/sessions/context` endpoint. `apom task set "..."` CLI. Timer wyświetla task name. |
| 3 | Proactive status check at conversation start | 5 | S | `pomodoro-check` skill uruchamiany automatycznie na starcie konwersacji. Kontekst informuje ton całej rozmowy. |

---

### Sprint #20 — Server-Side Nudges

**Goal:** Push zamiast pull — serwer generuje nudge'e, agent je dostarcza.

| # | Item | Impact | Effort | Details |
|---|------|--------|--------|---------|
| 1 | Nudge generation (Convex cron) | 5 | M | `convex/crons.ts` — co 30 min sprawdza czy user jest idle > 30 min w godzinach pracy. Jeśli tak → insert do `nudges` table. |
| 2 | `GET /api/nudges` endpoint + `apom nudges` CLI | 4 | S | Agent pobiera pending nudge'e. Marks as delivered. |
| 3 | Per-day accountability breakdown | 4 | S | `dailyScores: { date, score }[]` w `/api/activity/accountability`. Agent widzi wzorce tygodniowe. |

---

### Sprint #21 — Data Visualization

**Goal:** Wzorce widoczne na pierwszy rzut oka.

| # | Item | Impact | Effort | Details |
|---|------|--------|--------|---------|
| 1 | Weekly heatmap | 4 | M | GitHub-style SVG heatmap na dashboard. 7 rows × N weeks, kolor = ilość sesji/dzień. |
| 2 | History filtering by tag | 4 | M | Dropdown/pill selector w `history.tsx`. Filtruj sesje po tagach. Opcjonalnie po dacie. |
| 3 | Tag analytics endpoint | 3 | S | `GET /api/stats/tags` → `{ tag, count, totalMinutes }[]`. Agent analizuje rozkład czasu. |

---

### Sprint #22 — Goals & Discipline

**Goal:** Pomiarowa dyscyplina — cele dzienne/tygodniowe z postępem.

| # | Item | Impact | Effort | Details |
|---|------|--------|--------|---------|
| 1 | Daily/weekly goal setting | 5 | M | `userGoals` table w Convex. Settings: `dailyPomodoros`, `weeklyFocusHours`. Dashboard: progress bar. Agent: "2/6, cztery za planem." |
| 2 | Interruption reason tracking | 4 | S | `interruptReason?: string` na `pomodoroSessions`. Quick-select w UI: "distraction", "emergency", "wrong task", "phone call". `apom interrupt --reason "..."`. |
| 3 | Break enforcement (opt-in) | 4 | S | Setting: jeśli enabled, Timer blokuje start nowej work sesji dopóki break nie ukończony. |

---

### Sprint #23 — Integration & Sync

**Goal:** Zamknąć pętlę praca → dokumentacja → notatki.

| # | Item | Impact | Effort | Details |
|---|------|--------|--------|---------|
| 1 | Obsidian daily summary | 5 | S | `apom daily-summary [--date today]` → Markdown output. Formatuje sesje dnia jako structured note. |
| 2 | Session tagging at start via CLI | 3 | S | `apom start work 25 --tags "code,deep-work"` — agent auto-klasyfikuje sesje bez czekania na completion modal. |
| 3 | MCP server (agent-pomodoro-mcp) | 5 | M | Osobny npm package. MCP tools wrapping HTTP API. Natywna integracja z Claude Desktop bez terminala. |

---

### Sprint #24 — Hardening & Release

**Goal:** v1.0 release-ready.

| # | Item | Impact | Effort | Details |
|---|------|--------|--------|---------|
| 1 | Input validation limits on API | 3 | S | `notes` max 500 chars, `tags` max 10 items × 50 chars, `source` max 64 chars — enforce w mutations. |
| 2 | Remove `activeUserId` backdoor query | 3 | S | Replace z proper `GET /api/me` endpoint. Must-have before multi-user. |
| 3 | E2E tests for accountability + settings + API | 3 | M | `accountability.spec.ts`, `settings.spec.ts`, API contract tests. Dobiór do 50+ testów. |
| 4 | Self-hosted fonts (JetBrains Mono, Inter) | 3 | M | `fontsource` npm packages. Offline support. SW cache. |

---

### Sprint #25 — MCP Server

**Goal:** Native Claude Desktop integration via Model Context Protocol.

| # | Item | Impact | Effort | Details |
|---|------|--------|--------|---------|
| 1 | MCP server package | 5 | M | `packages/mcp/` — 8 MCP tools wrapping REST API. `pomodoro_status`, `pomodoro_start`, `pomodoro_stop`, `pomodoro_active`, `pomodoro_stats`, `pomodoro_heartbeat`, `pomodoro_accountability`, `pomodoro_nudges`. |
| 2 | npm publish + setup docs | 3 | S | `agent-pomodoro-mcp` on npm. Setup instructions in README + agent-onboarding skill. |

---

### Sprint #26 — Conversation-Aware Sessions

**Goal:** Agent auto-manages sessions based on conversation context.

| # | Item | Impact | Effort | Details |
|---|------|--------|--------|---------|
| 1 | Auto-start/stop skill rules | 5 | S | `pomodoro-check` skill: mandatory start on conversation begin, auto-complete on end/idle. |
| 2 | Task auto-capture from conversation | 5 | S | Agent infers task from first user message, calls `POST /api/sessions/task`. |
| 3 | Context-aware auto-tagging (git observer) | 4 | S | On `apom stop --auto-tag`: inspect `git diff --stat`, generate tags + notes. |

---

### Sprint #27 — Git Commit Correlation

**Goal:** Link pomodoro sessions to git output — measure productivity, not just time.

| # | Item | Impact | Effort | Details |
|---|------|--------|--------|---------|
| 1 | `commits` field on sessions | 5 | M | Schema: `commits: v.optional(v.array(v.object({...})))`. `POST /api/sessions/commits`. |
| 2 | `apom link-commits` CLI | 4 | S | Runs `git log --since/--until` for session window, POSTs commits. |
| 3 | Dashboard: commits per session | 3 | M | Show commit count in session list + "output per pomodoro" metric. |

---

### Sprint #28 — Focus Rhythm Analysis

**Goal:** Data-driven insights about when developer is most productive.

| # | Item | Impact | Effort | Details |
|---|------|--------|--------|---------|
| 1 | `GET /api/stats/rhythm` endpoint | 4 | M | Sessions bucketed by hour-of-day + day-of-week with completion rates. |
| 2 | `apom rhythm` CLI | 3 | S | Terminal heatmap of focus patterns. |
| 3 | Agent-readable rhythm data | 4 | S | Agent uses rhythm to recommend optimal session timing. |

---

### Sprint #29 — Weekly Retrospective

**Goal:** AI-generated weekly narrative — not just charts.

| # | Item | Impact | Effort | Details |
|---|------|--------|--------|---------|
| 1 | `GET /api/retro` endpoint | 4 | M | Structured retro data: per-day scores, tag breakdown, trends, comparison. |
| 2 | `apom retro` CLI | 4 | S | Markdown output for Obsidian. Agent generates narrative interpretation. |
| 3 | Weekly retro skill | 3 | S | `.claude/skills/weekly-retro/SKILL.md` — agent interprets retro data. |

---

### Sprint #30 — Pomodoro Debt + Regression Detection

**Goal:** Psychological discipline tools — debt accumulates, regressions alert.

| # | Item | Impact | Effort | Details |
|---|------|--------|--------|---------|
| 1 | `GET /api/stats/debt` endpoint | 4 | S | Missed pomodoros carry forward. "Today's target: 9 (6 base + 3 debt)." |
| 2 | `GET /api/stats/trends` endpoint | 4 | S | 7-day rolling vs previous 7-day for all metrics. Regression detection. |
| 3 | `apom debt` + `apom trends` CLI | 3 | S | Agent uses these for escalating nudge severity. |

---

## Future / Stretch

| Idea | Impact | Effort | Notes |
|------|--------|--------|-------|
| Focus Quality Score | 4 | M | Beyond binary complete/interrupt — measure focus intensity |
| Token tracking per session | 5 | M | Unique to AI coding — cost/value per pomodoro |
| Obsidian Auto-Sync | 4 | S | Daily note pipeline — automatic, not manual |
| Multi-repo awareness | 3 | S | Per-project focus analytics |
| Focus Mode OS integration | 4 | S | macOS DND on timer start/stop |
| Team accountability (multi-user) | 5 | L | Pod leaderboard. "Najsłabsze ogniwo." |
| Session replay / activity log | 4 | L | Structured log of what happened during session |
| Webhook on session events | 4 | L | Push to external systems on completion |
| Dark/light theme toggle | 2 | S | CSS vars override, toggle w Settings |
| Timer ARIA accessibility | 2 | S | Labels na progress ring, mode selector, controls |

---

## Technical Debt (fix along the way)

| Issue | Priority | Details |
|-------|----------|---------|
| `agentSummary` / `stats` duplicate logic | Nice-to-have | DRY: agentSummary should call stats internally |
| `retryQueue.ts` no TTL | Nice-to-have | Add 24h expiry to queued mutations |
| CLI `apiCall`/`apiPost` duplication | Nice-to-have | Single `apiFetch(method, path, data?)` |
| `completedRef` naming confusion | Nice-to-have | Rename to `completionArmedRef` |
| `workActivity` table no TTL | Nice-to-have | Convex cron cleanup > 90 days |
| Compiled .js files regenerating in convex/ | Fix now | Something triggers tsc compile → stale .js duplicates |

---

## Deployment Strategy

- **Staging:** Vercel preview deploys + staging Convex deployment (TBD: create `staging` Convex project)
- **Production:** Only after c3z manual testing on staging
- **Convex:** Dev = `first-curlew-203`, Prod = `efficient-wolf-51`, Staging = TBD
- **Rule:** Autonomous sprints deploy to staging only. Prod requires explicit approval.
