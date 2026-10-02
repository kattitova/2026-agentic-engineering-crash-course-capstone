# 2026-10-01 — show-days-in-status

**Reviewer:** proposal-reviewer sub-agent (separate session; planner ≠ checker)
**Pass:** first
**Reviewed:** `openspec/changes/show-days-in-status/proposal.md`, `design.md`, `tasks.md`,
`specs/kanban-board/spec.md` — all uncommitted (untracked directory), plus `spec.md`,
`AGENTS.md`, `docs/reviews/decisions.md`, `docs/review-log.md`, `openspec/specs/kanban-board/spec.md`
and the archived changes this plan builds on
**Structural validation:** `openspec validate show-days-in-status --strict` → `Change
'show-days-in-status' is valid` (exit 0, Node 22)
**Implementation state:** not started — `openspec list` reports 0/25 tasks, and `git status` shows
only the untracked change directory and an unrelated `.agent-log/actions.jsonl` modification. No
source file carries any part of this change.
**Verdict:** REVISE PROPOSAL — 0 critical, 1 major, 5 minor

The plan is unusually accurate about the code it will touch: every claim in Why, Impact and
Context checked out against the files, including the ones easiest to get wrong. The single
blocking item is a coverage hole in the delta spec, not an error of fact, and it is plausibly one
sentence of task text away from closed.

## Previously decided — not re-raised

| Closed item | Disposition | Why it is not raised here |
| --- | --- | --- |
| `R20260927-6` — clamp/wrap assertions match class substrings | Closed 2026-10-01 in `measure-long-value-layout` | Closed. `P20261001-1` below is **not** this finding: it is about a scenario this delta newly adds, not about the existing `ApplicationCard` assertions, which were deleted. |
| decisions.md §2026-09-27 note — the jsdom test for the column count's accessible name cannot distinguish the working fix from the broken one | Author's carried note | Task 4.1 reuses that pattern deliberately; the known limit of its jsdom test is already recorded and is not re-opened. |
| `R20260927-7` — red-then-green order not readable from git history | Declined, permanently | Not raised, at any severity. |
| `R20260929-3`, `R20261001-3` — commit typing/scoping | Accepted, not rewritten | History is not re-litigated. |
| 2026-09-27 §4 — "read per request, not per build" has no automated guard | Deferred, with its answer recorded | `listApplications`' `connection()` call (`lib/applications/queries.ts:17`) is relied on by this plan but is not this change's gap. |

No deferral in `docs/reviews/decisions.md` points at `show-days-in-status`, so there is nothing to
cash in here, and the exclusion of MVP item 6 does not dodge one. The ledger's "Open — not yet
decided" section is empty.

## 1. Scope against `spec.md`

- No findings.

Verified: MVP item 5 is `spec.md:55-56`, worded exactly as the proposal reads it, and
`statusChangedAt` is in the data model (`spec.md:39`) with the 2026-09-13 change-log entry naming
items 5 and 6 as its purpose (`spec.md:89-95`). Nothing in the plan adds functionality outside
that item, so no `spec.md` precondition applies.

MVP item 6 is genuinely excluded and the exclusion holds in the artifacts, not just in the prose:
`grep -i "stale\|14"` over the change directory returns only `proposal.md:26,35-38` and
`design.md:36,44,61` — all of them statements that item 6 is *not* in this change. The delta spec
and `tasks.md` contain no threshold, no APPLIED-specific rule and no styling task. The day count
is planned as a pure function of two instants (`design.md:65-74`), which is what makes item 6 a
caller rather than a second implementation.

One feature, one seam: the only thing the change does is render a derived number, and the one
supporting write-path edit (the optimistic `move` branch) exists because the badge would otherwise
contradict stored data. No data-model change — `prisma/schema.prisma:30` already has
`statusChangedAt DateTime @default(now())`, so no `npx prisma db push` obligation arises. The
`spec.md` change-log entry is itself a task (5.4) and names what future readers need: the day rule,
why calendar days lost, and that item 6 thresholds the same function.

## 2. Requirement coverage and testability

- **[Major]** `P20261001-1` `specs/kanban-board/spec.md:59-63` — the scenario "A very large count
  does not distort the board" promises an observable layout result ("without widening its column,
  and the other columns keep their positions") that no task verifies. Task 4.4
  (`tasks.md:60-61`) asserts only that a four-digit badge *renders*; task 4.5 (`tasks.md:62-65`)
  re-runs `e2e/long-value-layout.spec.ts`, which measures a 200-character **company name** — it
  inserts the long value as `company` and measures the column boxes and the heading's box
  (`e2e/long-value-layout.spec.ts:81-125`); it never produces a large badge. So the scenario's
  guarantee ships on a jsdom render assertion, which in this project is precisely the class of
  evidence that was measured, found hollow and deleted (`docs/reviews/decisions.md:199-208` —
  jsdom has no layout engine, and the substring assertions "could not fail for any reason the spec
  cares about and, beside a real measurement, read as evidence they were not"). What it costs:
  either the change ships a requirement with a test that cannot fail for the thing it promises, or
  the implementing session reaches task 4.4 and has to decide there how to measure it — the
  decision the plan was supposed to settle. Two cheap outs exist and the plan picks neither:
  extend 4.5 to insert a row whose `statusChangedAt` is several thousand days before now (the
  spec already inserts rows straight into `e2e.db` through `withDatabase`, `e2e/reset-board.ts:59`)
  and re-measure, or state in the delta/tasks that the layout half is carried by 4.5's measurement
  of the new row's presence, with the reason the badge's own width cannot move a column. Either is
  a sentence; the hole is that neither is written.
- **[Minor]** `P20261001-6` `specs/kanban-board/spec.md:122-125` — the scenario "The board is left
  open" is permissive ("the card **may** still show the count it was served with"), so it has no
  result that can fail and no task is reachable from it. The requirement's real content — that the
  number comes from the served instant and not from a clock inside the card — is in fact pinned,
  by task 3.3 (a card 12 days before the passed instant must read 12, which a card calling
  `new Date()` could not satisfy) and by task 1.2's "no `new Date()` of its own". Non-blocking: the
  guarantee is covered; the scenario is the part that cannot be asserted.

Everything else maps. Requirement 1's five scenarios reach tasks 1.1, 1.3, 3.2, 3.3 and 4.2 —
including the 20-hours-across-a-calendar-date case, which is the one that distinguishes the user's
chosen rule from the rejected one and is tested at both the function (1.1) and the card (4.2)
level. Requirement 2's future-instant scenario reaches 1.1 and 4.3; "every card has one, no card
shows two" reaches 4.4. Requirement 3's two scenarios reach 4.1, which asserts the *announced*
text is the full form — the right assertion, since the abbreviation is what the eye gets.
Requirement 4's four scenarios reach 2.1/2.2 (optimistic reset), 5.2 (survives a reload), 2.3
(failed move restores the original) and 5.3 (own-column drop unchanged).

No contradiction with the main specs. `openspec/specs/kanban-board/spec.md:247-258` already
requires that an own-column drop leave "the time its status last changed" alone; the new scenario
at delta `:111-114` adds the badge's observable half rather than restating the rule, which is the
right split. The "board reflects the stored data when it is opened" requirement
(`openspec/specs/kanban-board/spec.md:171-179`) is what delta requirement 5 leans on, and it
leans the same way, not against it.

The scenarios test guarantees rather than mechanisms throughout — the move scenarios assert what
the card reads, not that `applyChange` received a field, which is the weaker form this project has
been bitten by before.

## 3. Impact accuracy against the real code

- No findings at Critical or Major. Every claim I relied on is true today.
- **[Minor]** `P20261001-5` `proposal.md:53-66` — Impact does not name `spec.md`, though task 5.4
  edits it, nor the four existing test files tasks 2.1–4.4 modify (`components/board/Board.test.tsx`,
  `BoardColumn.test.tsx`, `ApplicationCard.test.tsx`, `useBoardCards.test.ts`); the list names the
  components and the hook only. Every file in Impact *is* reached by a task, so this is the
  unlisted-file direction, not a missing task.

Checked, one by one:

- `"use client"` on `components/board/Board.tsx:1` and `components/board/BoardColumn.tsx:1`;
  `components/board/ApplicationCard.tsx:1` is an `import`, no directive. So the card is in the
  client bundle and renders on both sides, and the proposal's reason for making the instant a prop
  (`proposal.md:19-22`, `design.md:9-12`) holds. `DraggableCard.tsx:1` is also a client component.
- `listApplications` calls `await connection()` before the query
  (`lib/applications/queries.ts:17`), with the comment giving the same reason the 2026-09-27
  change-log entry does. The page is per request, so "one instant per request" is available.
- `planStatusChange` returns `null` when `current.status === next` and otherwise sets
  `statusChangedAt: now` (`lib/applications/status.ts:30-38`). `planCardMove` also returns `null`
  for `to === from` (`lib/applications/move.ts:30-32`), so the design's "a card dropped on its own
  column never reaches `moveCard`" (`design.md:108-110`) is true at the Board level too
  (`Board.tsx:132-138`).
- `useBoardCards` holds `useOptimistic(applications, applyChange)` over `JobApplication[]`
  (`components/board/useBoardCards.ts:51`), with `BoardChange` the two-arm union at `:27-29`, and
  the `move` arm of `applyChange` setting **only** `status` (`:35-37`). So task 2.1 is a test that
  genuinely fails today, and the `remove` arm (`:32-33`) is a filter that cannot touch
  `statusChangedAt`, as `design.md:112` says.
- `BoardColumn`'s count is an `aria-hidden` span holding the digit plus one `.sr-only` span built
  from a single template literal (`BoardColumn.tsx:54-62`), with the name-prohibited-`generic`
  reasoning in the comment. The design restates it in the hedged form the ledger settled on
  ("not something a screen reader can be relied on to announce", `design.md:19-22`) rather than
  the stronger claim that did not reproduce — correctly.
- `e2e/long-value-layout.spec.ts` measures column boxes via `columnWidths` and the heading box in
  both Playwright projects (1280 `wide`, 1100 `wrapped`, `playwright.config.ts:17-25`); the card
  header is indeed the measured area.
- The seed's fixed instant is real: `SEEDED_AT = new Date("2026-01-15T09:00:00.000Z")` and
  `daysBefore` (`scripts/seed-e2e.ts:19-22`), with `statusChangedAt` set on all three rows
  (`:32,42,51`), so task 5.1 can read a row's stored value through `withDatabase`
  (`e2e/reset-board.ts:59`) and the aging hazard the design describes (`design.md:25-27`,
  `:135-139`) is accurately stated.
- Task 4.5's environment claim is true: `npm run e2e:db` runs
  `prisma db push --url file:./e2e.db --force-reset` (`scripts/seed-e2e.ts:62-66`), and the consent
  variable it names is the one `.agents/skills/prisma-cli/SKILL.md:194` requires. Worth noting the
  Playwright `webServer` command runs `npm run e2e:db` itself (`playwright.config.ts:31`), so *any*
  e2e task needs that consent — which both 4.5 and 5.6 ask for.
- "No new dependency": nothing in the tasks needs one. `package.json` has no date library and the
  rule is a subtraction and a floor, as `design.md:45` says.
- Conventions: `ActionResult`/`FAILED` live where the design assumes (`lib/applications/action-result.ts`,
  imported at `useBoardCards.ts:6`); `groupApplicationsByStatus` takes `JobApplication[]`
  (`Board.tsx:141`), which is what makes the rejected view-model alternative as invasive as
  `design.md:86-90` claims.

## 4. Tasks

- **[Minor]** `P20261001-2` `tasks.md:82` — `openspec verify --change show-days-in-status` is not a
  runnable command. The CLI (Node 22, `npx openspec --help`) exposes `validate`, `status`, `doctor`,
  `instructions`, `show` and so on, but no `verify`; "openspec verify" is the vendored skill
  `.claude/skills/openspec-verify-change/SKILL.md`, whose own description says it is what to use
  when the user says "openspec verify". Non-blocking because the gate is present and ordered
  correctly — 5.5 (`npm run verify`), 5.6 (e2e), 5.7 (the artifact-versus-code gate), then 5.8 (the
  review offer), exactly the order `AGENTS.md:75` prescribes. The risk is only that an
  implementing session runs it, sees `unknown command 'verify'` and treats the gate as
  nonexistent; naming the skill instead of a flag removes that.
- **[Minor]** `P20261001-3` `tasks.md:39-41` — task 3.1 does not say whether `now` is a required
  prop, and on this component tree that is not a free choice. `BoardColumn` gives every added prop
  a default for test-friendliness (`BoardColumn.tsx:22-29`), and `ApplicationCard` does the same
  (`ApplicationCard.tsx:54-60`); a `now = new Date()` default would keep `npx tsc --noEmit` and
  every existing test green while putting a clock back inside a component that renders twice —
  the exact failure the user's decision exists to prevent. Task 3.3 would catch it, so this is
  wording, not a hole. The same task also silently implies updating the existing call sites that
  render these components without `now` (nine renders in `ApplicationCard.test.tsx` alone, plus
  `BoardColumn.test.tsx` and `Board.test.tsx`), which no task mentions.
- **[Minor]** `P20261001-4` `tasks.md:21-23` — task 1.5 as worded ("the same two instants give the
  same answer whenever it is called") cannot fail: an implementation that ignored its `now`
  argument and called `new Date()` internally would still return the same answer twice within the
  same millisecond, and that is the only defect the task is aiming at. This project has already
  deleted one test for this exact reason (`R20261001-1`, `docs/reviews/decisions.md:166`: "a test
  that cannot fail is worse than no test, because it reads as evidence"). What would bite: two
  different `now` values must give different answers, and a fixed pair must give the same answer
  regardless of the wall clock.

Red-first compliance is right, and notably it is right in the hard direction. The three pieces of
new business logic each get a separate `(red)` task before the implementing task — 1.1/1.2 for
`daysInStatus`, 1.3/1.4 for `describeDaysInStatus`, 2.1/2.2 for the optimistic reset — and all
three can genuinely fail first: the module does not exist, and `applyChange`'s `move` arm provably
sets only `status` (`useBoardCards.ts:35-37`). The tasks that describe behaviour already true by
construction are *not* dressed as red — 2.3 (the optimistic change is dropped and the server list
wins, `useBoardCards.ts:111-117`) and 2.4 (the `remove` arm is a filter) both say "verify with a
test". That is the mistake task 2.1 of `edit-and-delete-application` made and had to have amended
afterwards, and this plan does not repeat it. `tasks.md:1-6` states the rule it is applying, which
is why the distinction is visible at all.

Sizing and order hold: each task is one commit's worth, no task depends on something a later task
introduces (the pure function lands before the threading, the threading before the badge, the
badge before the e2e), there is no rename bundled into feature work, and every task names its
verification — an assertion, `npx tsc --noEmit`, or a command. The new UI interaction has test
tasks at both levels (4.1-4.4 in jsdom, 5.1-5.3 in Playwright).

Task 5.8 succeeds at what `AGENTS.md` → "Always offer, never launch silently" asks. "**Offer** the
user an independent `reviewer` pass … and **wait for their answer**. Do not launch it unprompted —
this task is a reminder to ask, not authorization" cannot be read as authorizing a silent launch,
it names the recording location, and it says a decline is not recorded. Compare the archived
`edit-and-delete-application` task 7.8 ("Request a review pass…"), which is the wording the rule
was written against. No finding.

The aging hazard is handled everywhere it arises, not only where it was noticed: 5.1 computes its
expectation from the stored row, 5.2 and 5.3 assert *relative* outcomes (reads as today after a
move; unchanged after an own-column drop) rather than a literal, and every unit task injects both
instants. I found no task that hardcodes an aging-dependent value.

## 5. Design decisions

- No findings.

The chosen rule is implemented coherently with what the user decided. `design.md:49-61` records
the decision as the user's, names the discriminating case (status changed yesterday 17:00, read
today 09:00), and states what each rejected option costs: calendar days need a timezone the server
cannot know, and a client-side count mismatches the first paint. Both rejections are real, and the
second one is load-bearing — which is why the `suppressHydrationWarning` alternative
(`design.md:92-94`) is rejected on the same ground rather than on taste. The awkward consequence is
not hidden: it is answered by wording ("Today"), restated in the Risks section (`:126-128`), and
the delta spec says so in its requirement text rather than only in the design (`:10-13`).

The view-model alternative (`design.md:86-90`) is rejected on a claim I checked: the board does
move `JobApplication[]` through `useBoardCards`, `applyChange`, `groupApplicationsByStatus` and the
component tests, and widening it would give the optimistic `move` a second derived field to keep in
step with `status`. The rejection holds.

Every decision is reflected in the tasks — the two-function module in 1.1-1.4, the prop threading
in 3.1-3.3, the optimistic reset in 2.1-2.2, and the badge's placement below the position line with
`shrink-0 tabular-nums` in 4.1. The non-goals are consistent with the ledger and with the archived
changes; nothing irreversible is involved (no schema change, no removed guard, no migration); and
the one genuinely unverified platform claim — that a `Date` serialises across the RSC boundary — is
named as a risk with the fallback already described (`design.md:129-131`) rather than asserted as a
fact.

## Open questions

1. Task 5.1's expectation is computed from the stored `statusChangedAt` using the test process's
   clock, while the badge is computed from the server's request instant. Both floor against the
   same seeded instants, which sit at 09:00:00Z, so a run that straddles 09:00 UTC can disagree by
   one. Worth a tolerance, or is the window too narrow to spend anything on?
2. Should the announced form name the status ("12 days in Interview") rather than "12 days in this
   status"? The card's accessible name is the company (`ApplicationCard.tsx:71-72`), and the column
   is a landmark, so the status is reachable — but only by leaving the card. Author's call; the
   spec as written is satisfied either way.
3. `design.md:98-99` has the optimistic `move` set `statusChangedAt` to the served instant. On a
   page left open for hours, a just-moved card then reads "Today" while the stored row would read
   zero against a *fresher* instant — identical outcomes until the page is a day old, at which
   point the optimistic value is the one that is stale. Accepted, or worth a sentence in the design
   saying the badge is as of the served instant in both directions?

## Must be revised before apply

1. **[Major]** `P20261001-1` — the delta scenario "A very large count does not distort the board"
   (`specs/kanban-board/spec.md:59-63`) has no task that checks its layout guarantee. Either give
   it a measurement, or say in the artifacts which existing measurement carries it and why the
   badge's own width cannot move a column.

## Non-blocking suggestions — implementation does not depend on any of these

- `P20261001-2` — `tasks.md:82`: name the `openspec-verify-change` skill rather than a
  non-existent `openspec verify --change` CLI command.
- `P20261001-3` — `tasks.md:39-41`: say that `now` is a required prop, and that the existing
  component tests are updated with it.
- `P20261001-4` — `tasks.md:21-23`: task 1.5 as worded cannot fail; assert that two different
  `now` values give different answers.
- `P20261001-5` — `proposal.md:53-66`: add `spec.md` and the four existing test files to Impact.
- `P20261001-6` — `specs/kanban-board/spec.md:122-125`: the "board is left open" scenario is
  permissive and therefore unfalsifiable; its guarantee is covered by tasks 1.2 and 3.3.
