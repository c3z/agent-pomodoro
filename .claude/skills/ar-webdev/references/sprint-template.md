# Sprint Template — AR-WebDev

Szablon parametryczny. `{{parametry}}` podmieniane przez ar-webdev bootstrapper.
Claude MUSI wypełnić WSZYSTKIE parametry konkretnymi wartościami — żaden `{{...}}` nie może zostać w output.

---

## Wygenerowany SKILL.md

```markdown
---
name: sprint
description: |
  Sprint cycle: brief → build → staging → audit → triage → compare → PR.
  {{reviewer_count}} reviewerów: {{reviewer_names}}.
  Primary: {{primary_reviewer}}.
  Triggery: "sprint", "następny obrót", "next iteration".
---

# Sprint Cycle — {{project_name}}

## DEPLOYMENT POLICY

**ZAKAZ deployowania na produkcję bez zgody ownera.**

- Sprint pracuje na branchu `sprint/N`
- Deploy TYLKO na staging
- Po audycie i zielonym świetle → PR na GitHub (squash merge)
- Owner decyduje o deploy na prod

## Workflow

/sprint → branch → brief → build → staging → audit → triage → compare → PR

## Steps

### 0. BRANCH SETUP

git checkout -b sprint/N

### 1. SPRINT BRIEF

Read `s.md`, then generate brief:

## Sprint #N Brief
**Goal:** [one sentence]
**Success metric:** {{primary_reviewer}} score improvement, no regressions
**Scope:** [what we're fixing/building]
**Changed files (predicted):** [list]

Show brief to user. Proceed on confirmation.

### 2. BUILD/FIX

Execute fixes or build features from brief.
Launch parallel agents where possible.

### 3. STAGING DEPLOY

{{deploy_staging_command}}

After deploy, capture changed files:
git diff HEAD~1 --name-only > /tmp/sprint-changed-files.txt

Show staging URL to user.

### 4. AUDIT (Run #N)

Launch {{reviewer_count}} agents in parallel (Opus model):

{{reviewer_blocks}}

Each review MUST have:
Date: YYYY-MM-DD
Run: #N

Each review MUST compare with previous run.

#### Scoring rubric (FROZEN — do not change mid-sprint)

Each reviewer scores 5 subcategories 1-10. Average = overall score.

{{scoring_rubric}}

### 5. TRIAGE

After audits complete, consolidate:

### P1 (BLOCKER — do not deploy without fixing)
### P2 (SHOULD — fix this sprint)
### P3 (NICE — backlog)

### 6. COMPARE

| Reviewer | Run N-1 | Run N | Trend |
|----------|---------|-------|-------|
{{compare_rows}}
| **Consolidated** | | | |

### 7. UPDATE s.md

Update s.md with scores and backlog.

### 8. PULL REQUEST

git push -u origin sprint/N
gh pr create --title "Sprint #N: [goal]" --body "..."

Merge policy: Squash merge only. Owner decides.

### 9. PRODUCTION DEPLOY (po zgodzie ownera)

{{deploy_prod_command}}

## Stop Condition

Sprint cycle stops when:
- **{{primary_reviewer}} score >= {{target_score}}/10**
- **P1 items = 0**
- **Zero regressions** in last 2 runs

## Principles

1. **Structured brief before work** — know what you're solving
2. **Single metric** — {{primary_reviewer}} is the compass
3. **Fixed scope** — changed files only in audit
4. **Git tracking** — every fix, every audit
5. **Frozen eval** — rubric does not change mid-sprint
6. **Staging first** — never deploy to prod without owner approval
7. **Squash merge** — clean history on main
```

---

## Parametry

| Parametr | Źródło | Przykład |
|----------|--------|----------|
| `{{project_name}}` | Wywiad Q1 | `MyApp Dashboard` |
| `{{reviewer_count}}` | Dobór panelu | `4` |
| `{{reviewer_names}}` | Lista reviewerów | `End-user, Copywriter, SEO, Distribution` |
| `{{primary_reviewer}}` | Wybrany primary | `Copywriter` |
| `{{target_score}}` | Etap Q4: MVP=7.0, Launched=8.0, Growing=8.5, Mature=9.0 | `8.0` |
| `{{deploy_staging_command}}` | Wywiad Q7 | `npm run build && npx vercel --yes` |
| `{{deploy_prod_command}}` | Wywiad Q7 | `npx vercel --prod --yes` |
| `{{reviewer_blocks}}` | Wygenerowane — patrz format niżej | — |
| `{{scoring_rubric}}` | Wygenerowane — patrz format niżej | — |
| `{{compare_rows}}` | Wygenerowane — patrz format niżej | — |

---

## Format: `{{reviewer_blocks}}`

Dla KAŻDEGO reviewera wygeneruj blok w tym formacie:

```markdown
#### [Reviewer Name]
`review-[slug]` → `docs/reviews/[slug]-review.md`

[Persona opis — 1-2 zdania z reviewer-personas.md]

**Scores 5 subcategories 1-10:**
- [Subcategory 1] — [co ocenia]
- [Subcategory 2] — [co ocenia]
- [Subcategory 3] — [co ocenia]
- [Subcategory 4] — [co ocenia]
- [Subcategory 5] — [co ocenia]

**Reads:** [lista plików specyficznych dla projektu, nie generyczna]
```

### Przykład wygenerowanego bloku

```markdown
#### Copywriter
`review-copywriter` → `docs/reviews/copywriter-review.md`

Senior tech copywriter (Stripe/Linear level). Ocenia spójność głosu, precyzję terminologii, siłę CTA.

**Scores 5 subcategories 1-10:**
- Voice Consistency — jeden głos na wszystkich stronach?
- Terminology — kluczowe terminy spójne, bez sprzeczności?
- Translation Quality — język dodatkowy brzmi naturalnie?
- CTA Strength — CTA prowadzą do akcji?
- Trust Mechanics — copy buduje czy eroduje zaufanie?

**Reads:** src/pages/*.astro, src/components/*.tsx (user-facing text), src/lib/i18n.ts, src/content/blog/*.mdx
```

---

## Format: `{{scoring_rubric}}`

Tabela zbiorcza subcategorii:

```markdown
| Reviewer | Sub 1 | Sub 2 | Sub 3 | Sub 4 | Sub 5 |
|----------|-------|-------|-------|-------|-------|
| End-user | First Impression | Core Flow UX | Content Quality | Navigation | Trust |
| Copywriter | Voice Consistency | Terminology | Translation | CTA Strength | Trust Mechanics |
```

---

## Format: `{{compare_rows}}`

Jeden wiersz per reviewer:

```markdown
| End-user | —/10 | —/10 | — |
| Copywriter | —/10 | —/10 | — |
```
