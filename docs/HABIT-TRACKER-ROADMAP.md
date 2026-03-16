# Habit Tracker Module — Roadmap & Handoff Document

> Agent Pomodoro rozszerza się o moduł śledzenia nawyków oparty na protokole Hubermana.
> Dokument dla następnego zespołu agentów — kontekst, decyzje, architektura.

---

## 1. Co zbudowaliśmy do tej pory

Agent Pomodoro przeszedł 15 sprintów (#16-#30) + quality gate w jednej sesji. Stan:

**System surface area:**
- **5 tabel Convex:** pomodoroSessions, apiKeys, workActivity, nudges, userGoals
- **33 HTTP endpointy** (REST API z Bearer token auth)
- **23 komendy CLI** (`apom` — zero-dependency Node.js)
- **10 MCP tools** (native Claude Desktop integration)
- **6 route'ów React** (dashboard, timer, history, accountability, settings, sign-in)
- **8 skillów Claude** (pomodoro-check, auto-tag, weekly-retro, agent-onboarding, etc.)
- **63 testy E2E** (Playwright, 62 pass stabilnie)

**Kluczowe capability:**
- Timer z persistence (przeżywa nawigację + refresh)
- Accountability system (heartbeat tracking, shame board, score 0-100%)
- Server-side nudges (Convex cron co 30 min)
- Goals z debt tracking (zaległości się kumulują)
- Git commit correlation (linkuj commity do sesji)
- Focus rhythm analysis (kiedy jesteś najproduktywniejszy)
- Weekly retrospective (AI-interpreted narrative)
- Regression detection (7d vs 7d trend comparison)

---

## 2. Dla kogo to robimy

**Primary user: c3z (Cezary Dmowski)**
- Programista, 23 lata doświadczenia, pracuje z Claude Code codziennie
- ADHD pattern: fragmentacja, za dużo otwartych wątków, slow execution
- Potrzebuje zewnętrznej struktury — nie motywacji, a egzekucji
- Używa Obsidian do notatek, GitHub do kodu
- Monitorowany przez AI agenta (Atropa) który sprawdza i ocenia

**Secondary: Programiści używający Claude Code**
- Potrzebują dyscypliny focus time (pomodoro)
- Chcą śledzić nawyki towarzyszące produktywności (ćwiczenia, sen, deep work)
- Cenią dane i automatyzację, nie gamifikację z badge'ami

---

## 3. Po co to robimy

Pomodoro to jedno narzędzie dyscypliny. Ale c3z (i programiści jak on) potrzebują szerszego systemu:

- **Pomodoro śledzi focus time** — ale nie śledzi czy ćwiczysz, medytujesz, śpisz 7h
- **Nawyki wspierają pomodoro** — ćwiczenia poprawiają focus, sen poprawia completion rate
- **Agent widzi korelacje** — "Twoja completion rate spada o 40% w dniach bez ćwiczeń"
- **Huberman protocol** daje naukową strukturę — nie "track everything forever", ale 21-dniowe cykle z testowaniem

**Cel modułu:** Zamknąć pętlę od "pracuję z timerem" do "buduję nawyki które wspierają moją produktywność jako programisty".

---

## 4. Protokół Hubermana — zasady designu

### Reguły (z badań neuroscience):

| Reguła | Implikacja dla designu |
|--------|----------------------|
| **Max 6 aktywnych nawyków** | Enforced cap — UI nie pozwala dodać 7-go |
| **Cel: 4-5 z 6 dziennie (85%)** | Success = zielony od 4/6, nie wymagaj perfekcji |
| **Bez kompensacji** | Zrobił 3 dziś? Jutro dalej 6, nie 9 |
| **21 dni formowanie + 21 dni test** | Automatyczny cykl z fazą pasywną |
| **Fazy dnia** | Phase 1 (0-8h po przebudzeniu): trudne nawyki. Phase 2 (9-15h): łatwe |
| **Linchpin habits** | Nawyki-klucze które kaskadują na inne (ćwiczenia → sen → focus) |
| **Brak streak counter** | Pokaż % dni ukończonych, nie "14 day streak" |
| **2-day bins** | Tracking w parach dni, nie pojedynczo — "przynajmniej 2 konsekutywne" |

### Neuroscience backing:
- **Limbic friction** — mierz ile aktywacji wymaga nawyk (UI: difficulty rating)
- **Task bracketing** — basal ganglia odpala na START i END nawyku, nie w trakcie
- **Dopamine** — nagradzaj proces, nie tylko checkmark
- **Procedural memory** — wizualizacja sekwencji kroków redukuje limbic friction
- **Sen = Phase 3** — konsolidacja, bez snu system nie działa

---

## 5. Architektura modułu

### 5.1 Nowe tabele Convex

```typescript
// convex/schema.ts additions

habits: defineTable({
  userId: v.string(),
  name: v.string(),                    // "Morning exercise"
  description: v.optional(v.string()), // "30min resistance training"
  phase: v.union(v.literal("hard"), v.literal("easy")), // Huberman Phase 1 vs 2
  isLinchpin: v.boolean(),             // Foundational habit?
  color: v.optional(v.string()),       // UI color
  position: v.number(),               // Order in list (0-5)
  cycleStartedAt: v.number(),         // Start of current 21-day cycle
  cyclePhase: v.union(v.literal("forming"), v.literal("testing"), v.literal("established")),
  createdAt: v.number(),
  archivedAt: v.optional(v.number()), // Soft delete
})
  .index("by_user", ["userId"])
  .index("by_user_active", ["userId", "archivedAt"]),

habitCheckins: defineTable({
  userId: v.string(),
  habitId: v.id("habits"),
  date: v.string(),                    // "2026-03-16" (UTC date string)
  completed: v.boolean(),
  notes: v.optional(v.string()),
  completedAt: v.optional(v.number()), // Timestamp of checkin
})
  .index("by_habit_date", ["habitId", "date"])
  .index("by_user_date", ["userId", "date"]),
```

### 5.2 Nowe Convex functions

```
convex/habits.ts:
  - create(userId, name, description, phase, isLinchpin) → habitId
  - update(habitId, userId, fields) → void
  - archive(habitId, userId) → void
  - list(userId) → habits[] (active only)
  - checkin(habitId, userId, date, completed, notes?) → void
  - uncheckIn(habitId, userId, date) → void (toggle)
  - getCheckins(userId, sinceDaysAgo) → checkins[]
  - habitStats(userId) → per-habit completion rates, cycle status
  - dailyStatus(userId, date?) → today's habits + completion state
  - cycleAdvance(userId) → auto-transition forming→testing→established
```

### 5.3 Nowe HTTP endpointy

```
GET  /api/habits                    — list active habits
POST /api/habits                    — create habit
PATCH /api/habits/:id               — update habit
DELETE /api/habits/:id              — archive habit
POST /api/habits/:id/checkin        — mark done for today
DELETE /api/habits/:id/checkin      — unmark
GET  /api/habits/today              — today's status (all habits + done/not)
GET  /api/habits/stats?days=30      — completion rates per habit
GET  /api/habits/cycle              — current 21-day cycle status
```

### 5.4 Nowe CLI komendy

```
apom habits                         — today's habits + status (✓/✗)
apom habits add "Exercise" --phase hard --linchpin
apom habits done "Exercise"         — check in for today
apom habits undo "Exercise"         — uncheck
apom habits stats [days]            — completion rates
apom habits cycle                   — 21-day cycle status
apom habits archive "Exercise"      — remove from active
```

### 5.5 Nowe MCP tools

```
habit_status     — today's habits + completion
habit_checkin    — mark habit done (name or id)
habit_stats      — completion rates + cycle info
```

### 5.6 Nowy React route

```
app/routes/habits.tsx               — habit tracker page
app/components/HabitList.tsx        — list z checkboxami
app/components/HabitCalendar.tsx    — 30-day grid per habit
app/components/CycleIndicator.tsx   — 21-day cycle progress
```

### 5.7 Nowy skill

```
.claude/skills/habit-check/SKILL.md — agent sprawdza nawyki c3z
```

---

## 6. Sprint plan

### Sprint #32 — Habit CRUD + Schema

| # | Item | Effort |
|---|------|--------|
| 1 | Schema: `habits` + `habitCheckins` tables | S |
| 2 | `convex/habits.ts`: create, update, archive, list | S |
| 3 | HTTP endpoints: GET/POST/PATCH/DELETE /api/habits | M |
| 4 | CLI: `apom habits`, `apom habits add`, `apom habits archive` | S |

### Sprint #33 — Checkin system + Daily status

| # | Item | Effort |
|---|------|--------|
| 1 | `checkin`/`uncheckIn` mutations + HTTP endpoints | S |
| 2 | `dailyStatus` query — today's habits + state | S |
| 3 | CLI: `apom habits done "X"`, `apom habits undo "X"`, `apom habits` (status) | S |
| 4 | MCP: `habit_status`, `habit_checkin` | S |

### Sprint #34 — UI: Habit tracker page

| # | Item | Effort |
|---|------|--------|
| 1 | Route `/habits` + nav link | S |
| 2 | `HabitList` — today's habits z toggle checkboxami | M |
| 3 | Color coding: Phase 1 (hard) vs Phase 2 (easy), linchpin badge | S |
| 4 | "Add habit" form (max 6 enforced) | S |

### Sprint #35 — 21-day cycles + stats

| # | Item | Effort |
|---|------|--------|
| 1 | `CycleIndicator` — progress bar 21 dni, auto-transition | M |
| 2 | `habitStats` query — per-habit % completion, 2-day bins | M |
| 3 | `HabitCalendar` — 30-day grid per habit (green/red/gray) | M |
| 4 | CLI: `apom habits stats`, `apom habits cycle` | S |

### Sprint #36 — Agent integration + cross-correlation

| # | Item | Effort |
|---|------|--------|
| 1 | `habit-check` skill — agent sprawdza nawyki na starcie konwersacji | S |
| 2 | Pomodoro × Habit correlation — "completion rate +40% w dniach z exercise" | M |
| 3 | Dashboard widget — habit streak na home.tsx | S |
| 4 | E2E testy (8+) dla habits page | S |

### Sprint #37 — Polish + audyt

| # | Item | Effort |
|---|------|--------|
| 1 | Full site-audit z habit-aware reviewerami | M |
| 2 | Security review habits endpoints | S |
| 3 | /simplify na nowym kodzie | S |

---

## 7. Reviewer panel (dla audytu)

| Reviewer | Weight | Focus |
|----------|--------|-------|
| **Agent Access** | **50%** | Czy agent może tworzyć/sprawdzać/raportować nawyki przez CLI/MCP? |
| **End-user** | **30%** | Czy UI nawyków jest intuicyjny? Huberman rules enforced? |
| **Performance** | 10% | Nowe queries, nowa tabela — impact na load time? |
| **Neuroscience Fidelity** | 10% | Czy implementacja respektuje protokół Hubermana? (max 6, 85%, fazy, cykle) |

**Nowy reviewer: Neuroscience Fidelity** — sprawdza czy app implementuje protokół wiernie, nie "inspired by".

---

## 8. Czego się nauczyliśmy (lekcje z 15 sprintów)

### Process
- **Worktree isolation działa** — 3 agenty równoległe w osobnych worktree, cherry-pick na branch
- **Audyt co 3-5 sprintów** — pełny 4-reviewer audyt wyłapuje prawdziwe bugi (NaN bypass, shame field mismatch)
- **Security audit na końcu** — nie po każdym sprincie, ale koniecznie przed "done"
- **/simplify** — pomijalny na początku, ale kumuluje się. Robić co 5 sprintów.
- **Stale docs** = debt — CLAUDE.md i s.md muszą być aktualizowane CO SPRINT

### Technical
- **Convex codegen** — stale .js files wracają po każdym `npx convex dev`. Trzeba je czyścić.
- **Cherry-pick conflicts** — worktree agenty pracują na tym samym pliku (np. settings.tsx) → conflict resolution ręczne
- **Timer.tsx complexity** — 700+ linii. Persistence + interruption modal + break enforcement = za dużo w jednym pliku. Następny sprint powinien wyekstrahować.
- **useRef lazy init** — `useRef(() => ...)` nie działa w React (w przeciwieństwie do useState). Caught by typecheck.
- **E2E locator strict mode** — `text=Sound` matchuje 2 elementy. Zawsze używaj `getByRole` lub `{ exact: true }`.

### Design
- **Accountability > motivation** — shame board działa lepiej niż badge. Brutalna szczerość.
- **Agent write access = moat** — żadna inna pomodoro app nie ma CLI/MCP do sterowania timerem przez AI
- **Zero-friction = adoption** — auto-start sesji na początku konwersacji > manual `apom start`
- **Debt psychology** — zaległości pomodoro które się kumulują to silniejszy motywator niż "fresh start every day"

---

## 9. Decyzje architektoniczne dla następnego zespołu

1. **Habits to OSOBNA tabela, nie pole na pomodoroSessions** — nawyki żyją niezależnie od sesji pomodoro
2. **Max 6 enforced server-side** — nie tylko UI, mutation odrzuca 7-my nawyk
3. **Date jako string "YYYY-MM-DD"** — nie timestamp, bo checkin jest per-dzień, nie per-moment
4. **21-day cycle jest automatyczny** — Convex cron lub query-time computation, nie manual button
5. **Brak streak counter w UI** — pokaż % completion i 2-day bins, zgodnie z Hubermanem
6. **Phase (hard/easy) jest per-habit** — user sam klasyfikuje, agent może sugerować
7. **Linchpin flag** — boolean na habit, wyróżniony w UI, agent raportuje wpływ na inne metryki

---

## 10. Komendy startowe

```bash
# Dev
npm run dev
npx convex dev

# Build + test
npm run build && npm run typecheck && npm run test

# Staging deploy
npm run build && npx vercel --yes

# Convex deploy (dev)
npx convex dev --once

# Convex deploy (prod) — WYMAGA ZGODY c3z
npx convex deploy --yes

# Current test count
grep -c "test(" e2e/*.spec.ts
```

---

*Dokument przygotowany 2026-03-16 przez Atropę na podstawie 15 sprintów autonomicznej pracy.*
*Następny krok: Sprint #32 — Habit CRUD + Schema.*
