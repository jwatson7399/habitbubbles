# HabitBubbles — Design Specification

**Status:** approved design, not yet implemented
**Date:** 2026-07-26 (rev. 2 — banking, sizing floors, archive semantics)
**Fork parent:** `chorebubbles-solo` (`f2ff135`)
**Authors:** designed with Julian; reviewed against Codex critique across two rounds

This document is the design record for HabitBubbles, a third app in the ChoreBubbles
family. It specifies the product model, the mathematics, the architecture, and the
staged implementation path. It is the input to an implementation plan, not a plan
itself.

No folder or repository exists yet. Nothing in `chorebubbles` or `chorebubbles-solo`
changes as a result of this document.

---

## 1. Why this is a separate app

ChoreBubbles models **environmental debt**: a chore left undone makes the house worse,
and its urgency should grow without bound until someone deals with it. That assumption
is baked into the sizing math, the health metric, and the vocabulary.

Habits are **recurring opportunities**. Missing one should register, but it must never
inflate into an ever-growing guilt object. The time model is therefore different at the
root, not at the surface — which is why this is a fork rather than a mode inside
ChoreBubbles Solo. A shared codebase would be conditionals all the way down.

### 1.1 The user constraint that drives the model

Julian is an ER doctor whose shifts vary week to week, including occasional two-night
stretches roughly every month or two. No week resembles the last.

This makes conventional habit tracking a poor fit: fixed-weekday schedules, calendar
week resets, and consecutive-day streaks all assume a stable routine and punish its
absence. The design requirement he stated directly is:

> pressure to do X within Y days Z times, however I get that done

Every model decision below follows from that sentence. The app must never require a
predictable week, and must never penalize working nights.

### 1.2 The habits in scope

The seven habits the app is being designed for:

| Habit | Quota (N) | Period (P, days) |
|---|---|---|
| Meditate (5 min) | 1 | 1 |
| Read book A | 1 | 1 |
| Read book B | 1 | 1 |
| Journal | 1 | 1 |
| Lift weights | 1 | 2 |
| Brazilian jiujitsu | 2 | 7 |
| Cardio | 2 | 7 |

**Watering plants is deliberately excluded.** It is environmental debt in the exact
ChoreBubbles sense — an unwatered plant is genuinely worse off, and that urgency
*should* grow unbounded. It stays in ChoreBubbles Solo. Admitting it here would smuggle
debt semantics into the habit model.

---

## 2. Product model

### 2.1 One schedule primitive

Every habit is **N times per P rolling days**. That single primitive expresses every
habit in scope: "daily" is 1-per-1, "every other day" is 1-per-2, "twice a week" is
2-per-7.

There are no weekday selections, no calendar week resets, and no fixed time windows.
These are not merely unused — they are actively wrong for a variable shift schedule,
and are excluded permanently rather than deferred.

Periods **roll**. A calendar reset would produce a cliff where every bubble reinflates
at once, contradicting the lifecycle in §2.2 and reproducing the Monday-cliff problem
that ChoreBubbles' `METHODS.md` §2 already rejected.

### 2.2 Bubble lifecycle

A completed habit does not vanish and does not sit in a "done" state. It deflates to a
speck and **regrows continuously** toward its next opportunity. There is no finish
line, only rhythm.

Consequences: the field is never empty, so the daily-driver screen never rewards
success by disappearing; and a habit's size is always meaningful, because it always
encodes time-to-next-opportunity.

This was chosen deliberately over the alternative of persisting dimmed "done" bubbles,
with the tradeoff understood: continuous regrowth slightly undercuts the finality of
popping.

### 2.3 No spacing pressure

"Twice per week" means any two sessions in the period, including back-to-back. The app
does not push toward even spacing. A spaced-interval cadence ("every X days, evenly")
is a different product decision and is explicitly out of scope.

**Precisely:** there is no spacing pressure *within* the available quota, but the rolling
window limits credit to N completions in any P-day span. For a 1-per-1 habit, two
completions 23 hours apart cannot both earn credit — not because the app wants them
spaced, but because a single day cannot yield two days' worth of progress. Nothing in
the model rewards even distribution; it only declines to double-count.

---

## 3. Mathematics

All time arithmetic is elapsed milliseconds from absolute timestamps. The model
contains no local-midnight boundaries, no timezone-of-day logic, and no calendar
arithmetic. Daylight-saving transitions are therefore structurally incapable of
affecting any value in this section.

### 3.1 Pressure — quota fill decay

Each habit has **N slots**. A completion fills one slot, which then drains linearly
over P days.

```
contributing = the N most recent completions of the habit with age < P
slotFill(c)  = clamp(1 − age(c) / P, 0, 1)
filled       = Σ slotFill(c)   over contributing
pressure     = clamp(1 − filled / N, 0, 1)
```

**Only the N most recent completions contribute.** Extra work beyond quota therefore
buys no pressure relief at all — three BJJ sessions logged together behave exactly like
two. This is the natural reading of the slot metaphor: N slots, filled by your N
freshest completions.

Without this restriction, over-quota completions *bank* relief. Three sessions at t=0
evaluated at day 3 would give `filled = 1.71 → pressure 0.14`, versus `1.14 → 0.43` for
two — several days of extra quiet earned by a completion that receives no rhythm credit,
making the "over-quota" history label dishonest.

Note this selection is **not** the same as the rhythm credit pass in §3.3.2, and
deliberately so. Pressure asks a *now-relative* question — which of my N slots are
currently full — so its selection must be re-evaluated at every moment. Rhythm asks a
*historical* one — how many distinct opportunities did I take — so its selection is
fixed over the whole completion history. Using the historical pass for pressure
produces a stale-exclusion bug: with sessions at day 0, day 0 and day 6, the day-6
session is permanently excluded, so at day 8 the two day-0 slots have expired and
pressure reads 1.00 despite the user having trained two days earlier.

Worked examples:

| Habit state | filled | pressure |
|---|---|---|
| BJJ (2/7), nothing logged | 0 | 1.00 |
| BJJ, one session just now | 1 | 0.50 |
| BJJ, both just now | 2 | 0.00 |
| BJJ, both 3 days ago | 1.14 | 0.43 |
| BJJ, both 6 days ago | 0.29 | 0.86 |
| BJJ, three sessions just now | 2 | 0.00 (third excluded, not banked) |
| Meditate (1/1), done 12h ago | 0.5 | 0.50 |
| Meditate, done 24h ago | 0 | 1.00 |
| Lift (1/2), done 24h ago | 0.5 | 0.50 |

Properties this guarantees:

- **Bounded at both ends.** Never negative, never above 1. No guilt monster.
- **Continuous.** No discontinuity at any boundary, because there are no boundaries.
- **Degenerate case is intuitive.** For N=1 it reduces to `age / P`, a plain ramp.
- **Over-quota is inert.** Extra completions neither penalize nor bank relief.
- **Neglect is honest.** A never-completed habit sits at a flat 1.00 indefinitely.

The accepted cost of the last property: a habit added and never done remains a
permanently large bubble. It is capped, so it does not grow — but it is persistently
loud. Archiving is the release valve.

**Rejected alternative.** A phase-based formula
(`0.65·paceDeficit + 0.35·remaining·phase²` over anchored periods) was considered and
rejected. It requires discrete periods, and it produces a rollover cliff: a
never-completed daily habit scores 0.987 at phase 0.99 and 0.007 at phase 0.01,
meaning total neglect becomes invisible at every period boundary.

### 3.2 Bubble size — absolute, not relative

```
priority = pressure × (0.5 + 0.5 × importance / 5)

mathRadius      = BASE_RADIUS × priority        // may reach exactly 0
visualRadius    = max(SPECK_RADIUS, mathRadius) // SPECK_RADIUS ≈ 3–4px
interactRadius  = max(22, mathRadius)           // 44px minimum tap diameter
collisionRadius = interactRadius + SPACING      // physics keeps hit areas apart
```

**Four radii, deliberately separated.** At `pressure = 0` the mathematical radius is
exactly zero, and under §2.2 *many* habits sit there simultaneously — every habit is a
speck on a day when everything is done. With a single radius this breaks in two ways:
the visual bubble collapses into whatever CSS border happens to remain, and the invisible
44px hit targets overlap while the field's forces pull the zero-radius nodes toward
similar positions, leaving only the topmost bubble practically tappable.

The critical constraint is that **`d3-force` collision uses `collisionRadius`, not
`visualRadius`.** Sizing collision from the visual radius is exactly what lets specks
pile up on top of one another.

`SPECK_RADIUS` makes the deflated state an intentional visual element rather than a
rendering accident. It is a floor on *appearance* only — the priority signal remains
unfloored, preserving ChoreBubbles' hard-won separation of visual size from accessible
tap size.

Importance modulates amplitude; pressure drives the curve. At `pressure = 0` the
product is zero regardless of importance, which §2.2 requires.

**This diverges deliberately from ChoreBubbles.** ChoreBubbles uses
`rankBubbleTargets` to normalize priority against the field's own min and max, which is
correct for unbounded chore urgency where only relative ranking is meaningful. It is
wrong here: on a day when everything is done, min-max normalization would stretch the
differences between seven near-zero habits and inflate one to full size, destroying the
lifecycle guarantee on exactly the day it matters most.

Habits have a natural absolute ceiling (quota met = 0, quota untouched = 1), so the
absolute scale is meaningful and the relative one is a distortion.

Relative rank may still drive **z-index and radial centering**, where it is harmless.
A subtle relative multiplier on radius is deferred as a tuning knob, to be reconsidered
only after observing a real seven-habit field. The reason for preferring absolute is
testability: `pressure(habit, completions, now) → radius` is a pure function of one
habit's state, unit-testable without constructing the whole field.

Retained from ChoreBubbles unchanged: no floor on the *priority* signal, a 44px minimum
tap target via `bubbleHitDiameter`, compact labels below r=40, labels hidden below r=14.

### 3.3 Rhythm score

Two windows are kept strictly separate: habit period **P** drives bubble size; the
rhythm window **W** drives the score. Conflating them produces a headline number that
thrashes daily.

```
W          = settings.rhythmWindowDays         // default 14
W_h        = max(W, 2 × P)                     // per-habit rhythm window
effectiveW = min(W_h, now − anchorAt)          // proration for young habits
expected   = N × (effectiveW / P)
attainment = warmingUp ? null : min(1, creditedCompletions / expected)
rhythm     = mean(attainment) over habits where attainment ≠ null
```

Over a 14-day window the expectations are: meditate/readA/readB/journal 14 each, lift
7, BJJ 4, cardio 4. **Each habit contributes 1/7th of rhythm regardless of cadence.**

This equal weighting is the point. Counting raw opportunities would give the four daily
habits 79% of the score and make a completely blank fortnight of jiujitsu cost only
5.6%. Under this model it costs 14.3%.

Importance does **not** weight rhythm. Rhythm stays a clean "did I do what I said I
would" measure rather than a weighted composite; importance already influences bubble
size.

`min(1, …)` means over-quota never inflates the score and never penalizes — consistent
with ChoreBubbles' "over-goal stays green" rule.

#### 3.3.1 Warm-up

```
warmingUp = (now − anchorAt) < P
```

A habit is excluded from the rhythm mean until one full period has elapsed, and
displays as "warming up" rather than counting as either perfect or failing.

**Why this specific condition.** An earlier draft used `expected < 1 → attainment = 1`,
which is a real bug: a monthly habit (N=1, P=30) has mature expected activity of
`1 × 14/30 = 0.47`, permanently below 1, so it would report 100% forever even if never
completed. That guard confuses "new" with "low frequency."

The age-based warm-up and the per-habit window `W_h = max(W, 2P)` together eliminate
the problem at the root. After warm-up, `effectiveW ≥ P`, so `expected ≥ N ≥ 1`
always. No epsilon guard is needed anywhere.

At the default `W = 14`, `W_h` is 14 days for every habit in scope (the longest P is 7,
so 2P = 14), which makes the per-habit window a no-op today and correct the first time a
fortnightly or monthly habit is added.

#### 3.3.2 Credit capping

Only completions that represent distinct opportunities earn rhythm credit. Walking
completions in **ascending timestamp order**, a completion earns credit unless **N
already-credited completions fall within the preceding P days**; otherwise it is
skipped. The comparison is against previously *credited* completions, not all
completions, so the pass is deterministic and order-independent in its result.

- Meditate (1/1), tapped 7× today → first counts, rest excluded → **credit 1**
- BJJ (2/7), three sessions Saturday → first two count → **credit 2**

Without this, seven taps of a daily habit would earn seven credits against a 14-day
expectation — half a fortnight's meditation in one sitting.

All completions remain visible in history; only rhythm credit is capped. Bubble
pressure needs no equivalent rule, since it already clamps at 0.

### 3.4 Period anchoring

Streaks require discrete periods. Periods are anchored to the habit's creation
timestamp:

```
periodKey(t)       = floor((t − habit.anchorAt) / P)      // permanently stable
currentPeriodKey() = periodKey(now)                        // advances at boundaries
periodsAgo(t)      = currentPeriodKey() − periodKey(t)     // intentionally changes
```

**Why not calendar anchors.** Anchoring daily habits to local midnight — the
conventional choice — means a 1am post-shift completion credits the wrong day. That is
precisely the failure mode this design exists to avoid. `createdAt` anchoring is
arbitrary in time-of-day but *consistently* arbitrary, fully stable, requires no
"week start" setting, and cannot be cut by a night shift in a way the user notices.

**Why anchoring at all.** Walking backward from `now` in P-day chunks makes boundaries
slide continuously, so a completion migrates between chunks as hours pass and a streak
can change while the user is asleep.

Editing a habit's P re-indexes its historical periods. This is accepted and must be
documented in the UI rather than discovered.

### 3.5 Streaks

A period qualifies if it contains at least N credited completions. The streak is the
run of consecutive qualifying periods, most recent first.

- Current period, quota met → **extends** the streak
- Current period, quota not yet met → **ignored**, not a failure
- Period closes unmet → **breaks** the streak

Streaks are defined over quota periods, never over consecutive days. A consecutive-day
streak is hostile to shift work: a run of nights would break a 30-day streak through no
fault of the user, recreating exactly the guilt object the pressure curve was designed
to avoid. This formulation only asks whether the work got done inside the window given.

Streaks appear on the Log screen only, never on the bubble field.

### 3.6 Archiving and deletion

These are distinct operations with distinct semantics.

**Archive** (`archived: true`, carried by `habit:upsert` — no separate operation):

- Removed from the bubble field, the rhythm denominator, the streak summary, and
  suggestions.
- Historical completions are retained and remain visible in history.
- **Unarchiving sets a new `anchorAt` and starts a fresh warm-up**, retaining the
  historical completions. Resuming a habit after months away should not inherit a
  months-old anchor or an attainment figure computed across the gap.

**Delete** (`habit:delete`) removes the habit and its completions outright. It is
destructive and confirmed in the UI; archive is the non-destructive path.

Archiving a habit you are failing *does* raise rhythm, by shrinking the denominator.
This is deliberate — deciding to stop doing something is a legitimate act, not an
exploit — and it is covered by a test so it stays intentional.

### 3.7 Rhythm zones

Rhythm is normalized to [0, 1], so `greenStart` is a **fraction**, not a point total as
in ChoreBubbles:

| Zone | Range |
|---|---|
| `Getting started ⚠️` | 0.00 – 0.40 |
| `Maintaining 👍` | 0.40 – `greenStart` |
| `On top of it! 👌` | `greenStart` – 1.00 |

Default `greenStart = 0.80`, user-configurable, clamped to (0.40, 1.00] so it can never
strand below the amber boundary. Over-goal stays green.

### 3.8 Suggestions — "What should I do now?"

The one optional feature in v1.

```
suggestionScore = priority − 0.15 × (effort − 1) / 4
```

`priority` is the §3.2 value, so the ranking mostly exists already. The effort term is a
mild tiebreaker: among habits of similar urgency it surfaces the 5-minute meditation
ahead of a two-hour training session, which is the point of carrying `effort` at all.
The `0.15` coefficient is deliberately small — effort should break ties, never override
a genuinely urgent habit.

Ties break by higher importance, then by older `anchorAt`. Archived and warming-up
habits are excluded.

The coefficient and the tiebreaker order are **tuning parameters**, expected to be
revised against the real seven-habit field. A "quick wins only" time filter is the
natural next addition and is out of scope for v1.

---

## 4. Data model

```js
habit = {
  id,
  name,
  importance,   // 1–5, modulates bubble size
  effort,       // 1–5, static time-cost; used only for suggestion ranking
  quota,        // N
  periodDays,   // P
  createdAt,    // audit only — when this habit first existed, never changes
  anchorAt,     // period anchor and warm-up origin; equals createdAt initially
  archived,
}

completion = {
  id,
  habitId,
  habitName,    // denormalized, as in ChoreBubbles
  at,           // timestamp, ms; must be ≥ the habit's anchorAt
}

settings = { ownerName, rhythmWindowDays: 14, greenStart: 0.8 }
```

**`anchorAt` is separate from `createdAt` on purpose.** Using one field for audit
history, warm-up origin, and streak anchoring couples three concepts that need to move
independently — unarchiving and future schedule changes both want to reset the anchor
without falsifying when the habit was created. They are equal until something resets
the anchor.

**There is no `actor` field.** An earlier draft kept one to ease porting `healthPulse.js`,
which was a poor reason to put a dead field in a fresh schema. With one user and no
import path from ChoreBubbles, the actor predicate would be constant-true; `rhythmPulse`
detects new completion IDs directly, which is what `creditedCompletionIds` already does.

**Backdated completions before `anchorAt` are rejected**, not clamped. Permitting them
would generate negative period keys and an ill-defined warm-up. The time machine and the
completion UI both enforce this.

Removed from the chore schema: `freqDays`, `service`, `twoStep`, and the `service` /
`reset` actors. Those encode "the board got cleaned" and "we caught up" — chore
concepts with no habit meaning.

`effort` is a **static property set at creation**. It is not per-completion duration or
quantity logging, which remains out of scope.

Domain vocabulary is renamed properly rather than preserved to shrink the first diff:
`chores → habits`, `choreId → habitId`, `freqDays → periodDays`, `chore:upsert →
habit:upsert`.

### 4.1 Zone vocabulary

Rhythm is a 0–1 score, so ChoreBubbles' effort-zone bands map onto it directly, along
with the configurable green threshold and the over-goal-stays-green rule:

`Getting started ⚠️` → `Maintaining 👍` → `On top of it! 👌`

This language took real iteration to land in ChoreBubbles and is equally right for
rhythm. "Health" is deliberately not reused — it implies something is wrong when the
number dips. The metric is named **Rhythm**. Thresholds are specified in §3.7.

---

## 5. Architecture

### 5.1 Layout

```
src/
  App.jsx                      composition and app-level state, target < 600 lines
  screens/
    BubblesScreen.jsx          field + rhythm strip + "What should I do now?"
    LogScreen.jsx              rhythm, per-habit attainment, streaks, activity
    HabitsScreen.jsx           CRUD list
  components/
    BubbleField.jsx            physics field, near-verbatim from solo
    RhythmBar.jsx
    HabitEditor.jsx            name, importance, effort, N, P
    CompletionModal.jsx
    Modal.jsx
  model/
    bubblePhysics.js           byte-identical to ChoreBubbles
    bubblePresentation.js      neutral subset only
    habitData.js               normalization + applyOperation
    habitPeriods.js            anchored period keys
    habitPressure.js           quota fill decay
    habitPriority.js           priority → absolute radius
    rhythmModel.js             attainment, rhythm, streaks, zones
    habitHistory.js
    rhythmPulse.js
    suggestNow.js
  storage.js                   local-only persistence + pending-op queue
  config.js
```

`bubblePhysics.js` and `bubblePresentation.js` keep their **filenames** so `cmp` still
works against ChoreBubbles for the model-neutral parts.

### 5.2 Module dispositions from the fork parent

| Module | LOC | Disposition |
|---|---|---|
| `bubblePhysics.js` | 27 | Byte-identical. Drag, throw, `releaseBubbleNode`, the iOS `lostpointercapture` fix. |
| `main.jsx` | 9 | Byte-identical. |
| `bubblePresentation.js` | 57 | Keep `clampBubbleRadius`, `bubbleHitDiameter`, `usesCompactBubbleLabel` and their constants. Drop `bubblePriority` and `rankBubbleTargets` — both encode chore urgency and relative ranking. |
| `healthPulse.js` | 20 | → `rhythmPulse.js`. The actor predicate is dropped entirely (§4); detection keys on new completion IDs alone. The sequence-counter-as-React-key trick carries over intact. |
| `choreHistory.js` | 37 | → `habitHistory.js`. Drop service/reset labels; reframe impact as counted vs. over-quota. |
| `storage.js` | 113 | Strip ~60 lines of Supabase auth (magic link, OTP, `getAuthSession`, `compareAndSetShared`). Keep local persistence and the pending-op queue. |
| `logModel.js` | 215 | Replaced by `rhythmModel.js`. The ~50 lines of pause machinery (`pausedDuration`, `effectiveAge`) are deleted outright. |
| `twoStepChore.js` | 66 | Deleted with its 88-line suite. |
| `supabase-schema.sql` | — | Deleted. |

**Pause machinery is cut deliberately.** ChoreBubbles needs pause-aware aging because
vacations are real there. Here, schedule variance is absorbed by the quota model
itself, and the user's night blocks (two nights, roughly monthly) are a small
perturbation in a 14-day window. This removes the trickiest subsystem in `logModel.js`.

### 5.3 Operations

`normalizeData` and `applyOperation` **move out of `App.jsx`** into `model/habitData.js`
and gain direct tests. They are domain logic and are currently the largest violation of
the project's "pure logic in tested modules" convention.

Retained: `completion:add`, `completion:remove`, `habit:upsert`, `habit:delete`,
`habit:add-many`, `habit:clear`, `settings:patch`

Dropped: `completion:add-and-advance`, `completion:remove-and-restore` (two-step
deferred), `pause:set` (pauses cut)

The op-replay pipeline is retained despite local-only operation, because **inverse
operations replayed through it** are what implement undo, and the same pipeline drives
the time-machine sandbox.

The **pending-operation queue is separate** and is persistence infrastructure for
unsynced work — it does not itself power undo. With sync removed it may have no
remaining job. Stage 3 evaluates stripping it; it is retained only if it earns its
place.

**The time machine is kept**, relabelled away from chore vocabulary. Scrubbing forward
is how quota fill decay can be observed and trusted before shipping, and it doubles as
a manual check on §3.1.

### 5.4 Storage and sync

Local-only. `SUPABASE_URL` and `SUPABASE_ANON_KEY` stay empty, as in ChoreBubbles Solo.
No auth, no OTP, no RLS, no household ID. Single user, single device.

Cross-device sync is out of scope for v1 and re-addable later without migration.

---

## 6. Identity isolation

**This is the one genuinely dangerous part of the fork.** Both apps will be served from
`jwatson7399.github.io`, and `localStorage` is scoped to **origin, not path**. ChoreBubbles
Solo's isolation from the dual app today rests entirely on one variable: both use the
prefix `chorebubbles:data:` and differ only by ID suffix. That works, but it is one
wrong constant away from two apps sharing a store.

HabitBubbles changes the **prefix**, not just the suffix.

| Surface | ChoreBubbles Solo | HabitBubbles |
|---|---|---|
| Data key | `chorebubbles:data:chorebubbles-solo-local` | `habitbubbles:data:habitbubbles-local` |
| Pending queue | `chorebubbles:pending:…` | `habitbubbles:pending:…` |
| Intro flag | `chorebubbles-solo:seenIntro:v1` | `habitbubbles:seenIntro:v1` |
| Manifest `name` | ChoreBubbles Solo | HabitBubbles |
| Manifest `short_name` | CB Solo | Habits |
| Package name | `chorebubbles-solo` | `habitbubbles` |
| Repo / Pages path | `chorebubbles-solo` | `habitbubbles` |

Every identity surface to change, enumerated:

- `localStorage` data prefix and pending-operation prefix
- Intro / version flags
- `package.json` name
- Document `<title>` and HTML metadata
- Manifest `name`, `short_name`, `description`, `id`, `start_url`, `scope`
- Workbox `cacheId` and service-worker cache name
- Icons and Apple touch icon
- GitHub repository name and Pages path
- Any copied test fixtures containing `chorebubbles`
- Domain field names and operation names

**HabitBubbles gets visibly distinct icons and a different accent color.** Three similar
bubble PWAs on one phone are otherwise easy to confuse.

**Verification happens before the app is opened for the first time.** A first run with
colliding keys would write bad data into the live ChoreBubbles Solo app.

---

## 7. Staged implementation

Extraction is separated from semantic conversion so regressions stay bisectable and no
single diff mixes file moves, renames, and new mathematics.

**Stage 1 — Fork and isolate identity.**
Copy `chorebubbles-solo` into `~/Claude Code/habitbubbles` as a fresh repository. Change
every surface in §6. Replace `README.md`, drop `SOLO_DIRECTION.md` and
`supabase-schema.sql`, and carry this spec in as `METHODS.md`'s first section. No
behavior changes.
*Gate:* all 42 inherited tests pass; `npm run build` clean; storage keys verified
disjoint from ChoreBubbles Solo **before first launch**.

**Stage 2 — Mechanical split.**
Split `App.jsx` (1,803 lines) into the §5.1 layout. Extract `normalizeData` and
`applyOperation`. Pure file moves and imports; no logic changes.
*Gate:* **all 42 inherited tests still pass with their assertions and expected behavior
unchanged.** Import paths and test file locations necessarily move during the split;
nothing else may. At this point HabitBubbles is
functionally ChoreBubbles Solo with a new identity and a new file layout — an objective
baseline proving the split changed nothing.

**Stage 3 — Habit model.**
Introduce the §4 schema, `habitPressure.js`, `habitPeriods.js`, `habitPriority.js`.
Delete `twoStepChore.js`, the pause machinery, and `logModel.js`. Absolute sizing
replaces relative ranking.

**Stage 4 — Rhythm.**
`rhythmModel.js`: attainment, warm-up, credit capping, streaks, zones. `rhythmPulse.js`.

**Stage 5 — Screens.**
Bubbles, Log, Habits rewritten against the new model. `HabitEditor` with name,
importance, effort, N, P.

**Stage 6 — Suggestions.**
`suggestNow.js` and its entry point.

**Stage 7 — Publish.**
New public repo, GitHub Actions Pages source, verify HTTP 200.

Each stage is gated on `npm test` + `npm run build` and lands as a focused commit.
Nothing is pushed without explicit instruction.

---

## 8. Testing

Target ~40 tests. Every edge case litigated during design gets a regression test so
none can silently return.

**Pressure (`habitPressure.js`)**
- The full §3.1 table: BJJ at 0, 1, 2 completions and at 3 and 6 days of age
- N=1 ramp: `age / P` for meditate and lift
- Over-quota clamps to 0 and never goes negative
- **No banking:** three BJJ sessions at t=0 give the same pressure at every subsequent
  time as two sessions at t=0 — the over-quota regression
- **No stale exclusion:** sessions at day 0, day 0, day 6 yield pressure well below 1.00
  at day 8, proving pressure does not reuse the historical credit pass
- **A never-completed habit holds steady at pressure 1.00** — the anti-cliff test; this
  is the assertion that the rejected phase-based formula would fail
- Zero or invalid `quota` / `periodDays` never produce `NaN`

**Periods (`habitPeriods.js`)**
- `periodKey(completionTs)` is **permanently stable** across many sampled `now` values
- `currentPeriodKey(now)` **advances** at boundaries
- `periodsAgo` changes as periods elapse — asserted separately so a test cannot lock in
  frozen relative indices while appearing to prevent the anchoring bug
- A completion exactly on a period boundary
- Backdated completions on each side of a boundary
- **A DST transition changes nothing** — same pressure, same period keys across the
  boundary, pinning the design property that the model contains no local-time arithmetic

**Rhythm (`rhythmModel.js`)**
- Warm-up: a monthly habit (N=1, P=30) reports `null`, not 100% — pins the
  `expected < 1` bug
- After warm-up, `expected ≥ 1` for every habit including monthly
- Proration: a habit added this morning does not tank rhythm
- Credit cap: 7 meditation taps credit 1; 3 BJJ sessions credit 2; all remain in history
- Equal weighting: a blank fortnight of BJJ costs 14.3%, not 5.6%
- Over-quota never raises attainment above 1
- Archive/delete removes a habit from the rhythm denominator — deliberate, since
  archiving a failing habit does raise rhythm
- **Pressure 1.0 and attainment 0 asserted in the same test**, so the opposite
  polarities are visible side by side and cannot be confused

**Streaks**
- In-progress period never breaks a streak
- In-progress period with quota met extends it
- A closed unmet period breaks it

**Sizing (`habitPriority.js`)**
- At `pressure = 0`, `mathRadius` is 0 but `visualRadius` ≥ `SPECK_RADIUS` and
  `interactRadius` ≥ 22
- `collisionRadius` ≥ `interactRadius` for every priority, so hit areas cannot overlap
- Seven simultaneously zero-pressure habits produce seven non-overlapping hit targets

**Archiving**
- Archived habits leave the field, rhythm denominator, streaks, and suggestions
- Archived habits' completions remain in history
- Unarchiving sets a new `anchorAt` and re-enters warm-up, retaining completions
- Delete removes habit and completions; archive does not

**Operations (`habitData.js`)**
- Duplicate completion-operation replay is idempotent
- Undo restores quota credit correctly
- A completion backdated before `anchorAt` is rejected, not clamped, and never produces
  a negative period key

**Isolation**
- HabitBubbles storage cannot read or write ChoreBubbles Solo's keys
- PWA build assertions for the new manifest identity

**Ported**
- `bubblePhysics` and the retained `bubblePresentation` suites, unchanged

---

## 9. Explicitly out of scope for v1

Recorded so they are not re-proposed:

habit stacks · duration / quantity logging · calendar heatmaps · spacing or
interval cadence · pauses and vacations · Supabase sync · fixed-weekday scheduling ·
multiple-times-per-day habits · abstinence / "don't do X" habits · importance weighting
in the rhythm score · relative-rank multiplier on radius

Habit stacks and duration/quantity are the two most likely to be wanted after real use.
Neither constrains the v1 data model, which is what makes deferring them safe rather
than merely optimistic.

---

## 10. Open items

- **Accent color and icon direction** for visual distinction from the two ChoreBubbles
  apps — deferred to implementation.
- **`BASE_RADIUS`, `SPECK_RADIUS`, `SPACING`, and the priority→radius curve** need
  tuning against a real seven-habit field. A gamma on `priority` is the expected knob.
- **The suggestion effort coefficient (0.15) and tiebreaker order** (§3.8) are starting
  values, not derived ones.
- **The relative-rank multiplier** (§3.2) is reconsidered only after observing that
  field.
