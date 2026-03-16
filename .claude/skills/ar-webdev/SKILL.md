---
name: ar-webdev
description: |
  Bootstrapuje sprint cycle + multi-perspektywiczny audyt dla projektu webdev.
  Wywiad → dobór panelu reviewerów → generacja sprint skill + site-audit + s.md.
  Karpathy autoresearch pattern. Użyj na początku projektu web lub gdy chcesz
  dodać structured quality tracking do istniejącego.
  Triggery: "ar-webdev", "autoresearch", "dodaj sprint loop", "quality tracking".
---

# AR-WebDev — Autoresearch Sprint Bootstrapper

Buduje dopasowany cykl sprint + multi-perspektywiczny audyt dla projektu webdev.
Wzorowany na OnTilt sprint cycle (Karpathy autoresearch pattern).

## Kiedy używać

- Nowy projekt web — chcesz od razu quality tracking
- Istniejący projekt — chcesz dodać structured audit loop
- Potrzebujesz reviewer panel dopasowany do typu projektu

## Workflow

```
/ar-webdev → wywiad (7 pytań) → propozycja panelu → user potwierdza → generacja plików
```

## Step 1: WYWIAD

Zadaj pytania sekwencyjnie. Nie generuj niczego przed zakończeniem wywiadu.

| # | Pytanie | Czego szukasz |
|---|---------|---------------|
| 1 | **Co to jest?** Opisz projekt w 1-2 zdaniach. | Typ: SaaS / blog / e-commerce / dev tool / research platform |
| 2 | **Kto to używa?** Kim jest primary user? | Persona: developer / manager / consumer / researcher |
| 3 | **Stack?** Framework, hosting, DB, kluczowe integracje. | Deploy commands, ograniczenia techniczne |
| 4 | **Etap?** Idea → MVP → Launched → Growing → Mature | Determinuje target score i primary reviewer |
| 5 | **Co boli?** Jaki problem chcesz rozwiązać audytem? | Klucz do wyboru primary reviewer |
| 6 | **Metryki?** Masz analytics? Co śledzisz? (brak = też OK) | Czy dodać analytics/conversion reviewera |
| 7 | **Deploy?** Jak deployujesz? Staging? CI/CD? | Komendy do szablonu sprint |

## Step 2: DOBÓR PANELU REVIEWERÓW

Na podstawie wywiadu zaproponuj **3-5 reviewerów** z puli w `references/reviewer-personas.md`.

### Zasady doboru

1. **End-user** — ZAWSZE w panelu (ale nie musi być primary)
2. **Primary** — JEDEN reviewer jako główny kompas. Wyznacza stop condition.
3. **Specjaliści** — 2-3 dopasowanych do bólu i etapu projektu

### Jak wybrać primary

| Ból z wywiadu (Q5) | Primary reviewer |
|---------------------|------------------|
| "UX jest słaby" / "nikt nie wraca" | End-user |
| "nikt o nas nie wie" / "brak ruchu" | Distribution Strategist |
| "copy jest niespójny" / "źle brzmi" | Copywriter |
| "wolno ładuje" / "mobilka nie działa" | Performance Reviewer |
| "nikt nie kupuje" / "nikt nie kliknie" | Conversion Optimizer |
| "boimy się o dane" / "compliance" | Security Auditor |
| "content nie rankuje" / "Google nas nie widzi" | SEO Auditor |
| "design nie trzyma się kupy" | Brand/Design Reviewer |
| "devs nie umieją zacząć" / "docs ssą" | Developer Experience |

### Target score (z etapu Q4)

| Etap | Target score primary |
|------|---------------------|
| MVP | >= 7.0/10 |
| Launched | >= 8.0/10 |
| Growing | >= 8.5/10 |
| Mature | >= 9.0/10 |

### Przykłady doboru per archetype

**SaaS dashboard (Growing, "konwersja boli"):**
| # | Reviewer | Primary? |
|---|----------|----------|
| 1 | End-user | — |
| 2 | Conversion Optimizer | PRIMARY |
| 3 | Performance Reviewer | — |
| 4 | Security Auditor | — |

**Blog / thought leadership (Launched, "nikt nie czyta"):**
| # | Reviewer | Primary? |
|---|----------|----------|
| 1 | End-user | — |
| 2 | Distribution Strategist | PRIMARY |
| 3 | Copywriter | — |
| 4 | SEO Auditor | — |

**Dev tool / API (MVP, "docs są chaotyczne"):**
| # | Reviewer | Primary? |
|---|----------|----------|
| 1 | End-user | — |
| 2 | Developer Experience | PRIMARY |
| 3 | Performance Reviewer | — |

**E-commerce (Growing, "mobile UX"):**
| # | Reviewer | Primary? |
|---|----------|----------|
| 1 | End-user | PRIMARY |
| 2 | Conversion Optimizer | — |
| 3 | Performance Reviewer | — |
| 4 | Accessibility Auditor | — |

### Propozycja — pokaż userowi

```markdown
## Proponowany panel reviewerów

| # | Reviewer | Rola | Primary? | 5 subcategorii |
|---|----------|------|----------|----------------|
| 1 | End-user | [persona z Q2] | — | First Impression, Core Flow UX, Content, Navigation, Trust |
| 2 | [Specjalista] | [opis] | PRIMARY | [5 subcategories z reviewer-personas.md] |
| 3 | [Specjalista] | [opis] | — | [5 subcategories] |

**Stop condition:** [Primary] >= [target z etapu]/10, P1 = 0
**Dlaczego ten panel:** [1 zdanie — bo Q5 wskazuje na X]
```

User potwierdza lub modyfikuje. Dopiero po OK → generacja.

## Step 3: GENERACJA PLIKÓW

Wygeneruj pliki w project directory:

### 3a. Sprint Skill → `.claude/skills/sprint/SKILL.md`

Użyj szablonu z `references/sprint-template.md`. Wypełnij WSZYSTKIE parametry `{{...}}` danymi z wywiadu i doboru panelu. Nie zostawiaj żadnych placeholderów.

### 3b. Site Audit Skill → `.claude/skills/site-audit/SKILL.md`

Standalone audit skill. Każdy reviewer = osobny agent (parallel, Opus).
Dla każdego reviewera wygeneruj blok:

```markdown
#### [Reviewer Name]
`review-[slug]` → `docs/reviews/[slug]-review.md`

[Persona description z reviewer-personas.md]

**Scores 5 subcategories 1-10:**
- [Sub 1] — [opis]
- [Sub 2] — [opis]
...

**Reads:** [lista plików specyficzna dla projektu]
```

### 3c. Session Summary → `s.md`

```markdown
# Session Summary — [Project Name]

## Current Sprint: #0 (bootstrap)
## Consolidated Score: —/10
## Stop Condition: [primary] >= [target], P1 = 0

## Scores

| Reviewer | #1 |
|----------|-----|
| [Reviewer 1] | — |
| [Reviewer 2] | — |
| **Consolidated** | — |

## Backlog
### P1 (BLOCKER)
*(awaiting first audit)*
### P2 (SHOULD)
### P3 (NICE)

## Deployment
- **Staging:** [command z Q7]
- **Production:** [command z Q7] — WYMAGA ZGODY OWNERA
```

### 3d. Reviews directory

```bash
mkdir -p docs/reviews/
```

### 3e. CLAUDE.md update

Append to CLAUDE.md:

```markdown
## Quality Tracking

Sprint cycle: brief → build → staging → audit → triage → compare → PR.
Session summary and priorities in `s.md`.

| Reviewer | #1 |
|----------|-----|
| [Reviewer 1] | — |
| [Reviewer 2] | — |

[Primary reviewer] is the main quality driver. Stop condition: >= [target]/10.
```

## Step 4: WERYFIKACJA

Po generacji pokaż podsumowanie:

```markdown
## AR-WebDev Bootstrap Complete

**Pliki:**
- `.claude/skills/sprint/SKILL.md` — sprint cycle z [N] reviewerami
- `.claude/skills/site-audit/SKILL.md` — standalone audit ([N] agentów)
- `s.md` — session summary
- `docs/reviews/` — output directory
- CLAUDE.md — updated

**Panel:** [lista]
**Primary:** [kto] (bo: [1 zdanie])
**Stop condition:** [metric]

**Następny krok:** `/sprint` lub `/site-audit`
```

## Zasady

1. **Wywiad przed generacją** — nie generuj bez pełnego wywiadu
2. **3-5 reviewerów** — mniej = za mało perspektyw, więcej = szum
3. **Jeden primary** — single metric, nie 5 równorzędnych
4. **Frozen eval** — rubric nie zmienia się mid-sprint
5. **Staging first** — deploy staging przed prod, zawsze
6. **Primary = ból** — reviewer dopasowany do Q5, nie do "co fajnie brzmi"
7. **Concrete output** — żaden `{{placeholder}}` nie może zostać w wygenerowanych plikach
