# 2026-10-02 — flag-stale-applications

**Reviewer:** proposal-reviewer sub-agent (separate session; planner ≠ checker)
**Pass:** first
**Launched:** prompt named the change and restated this definition's own procedure (resolve scope,
read the ledger and earlier passes, write one file with a verdict). It listed **no** things to check,
so the checklist below is unsteered. Whether it came through `.claude/hooks/review.mjs` is not
visible from inside the session.
**Reviewed:** `openspec/changes/flag-stale-applications/proposal.md`, `design.md`, `tasks.md`,
`specs/kanban-board/spec.md`, `.openspec.yaml` — all uncommitted (untracked directory). Read
alongside `spec.md`, `AGENTS.md`, `docs/reviews/decisions.md`, the earlier pass
`docs/proposal-reviews/2026-10-01-show-days-in-status.md`, `openspec/specs/kanban-board/spec.md` and
the code the Impact section names.
**Structural validation:** `openspec validate flag-stale-applications --strict` → `Change
'flag-stale-applications' is valid` (exit 0, Node 22)
**Implementation state:** not started — `openspec list` reports 0/21 tasks; `git status` shows only
the untracked change directory and the unrelated `.agent-log/actions.jsonl` modification. HEAD is
`1ba5682` (show-days-in-status archived).
**Verdict:** REVISE PROPOSAL — 0 critical, 1 major, 4 minor

The plan reads the codebase correctly almost everywhere — every load-bearing claim in Why, Impact
and Context checked out. The one blocking item is a delta scenario no task reaches, which the
design itself promises a test for. It is one task away from closed.

## Previously decided — not re-raised

| Closed item | Disposition | Why it is not raised here |
| --- | --- | --- |
| `R20261001-1` — a test that cannot fail on its own assertion | Accepted (fixed by deletion) | Not re-raised. `P20261002-2` below is a *new* task in *this* plan that would produce the same class of test; the ledger entry is cited as the reason it matters, not reopened. |
| `R20260927-6` — clamp/wrap assertions match class substrings | Closed 2026-10-01 in `measure-long-value-layout` | Not touched. Task 4.4 extends the measurement that closed it. |
| `R20260927-7` — red-then-green not readable from git history | Declined, permanently | Not raised. |
| `R20260929-3`, `R20261001-3` — commit typing/scoping | Accepted, not rewritten | Not raised. |
| 2026-10-02 `spec.md` entry — compute contrast against the actual tint (`R20261002-3`) | Accepted (fixed), and addressed to this change | Not a deferral in the ledger, but written for item 6. Cashed in by the plan itself: task 2.2 computes the ratio against the tint first. No finding. |

No row in `docs/reviews/decisions.md` is deferred to `flag-stale-applications` or to MVP item 6, so
there is nothing to cash in and no deferral is dodged. The ledger's "Open — not yet decided" section
is empty. The earlier proposal pass (`2026-10-01-show-days-in-status`) concerns a different change;
its findings are not carried here, though the plan visibly learned from two of them (task 1.3 is the
answer to `P20261001-4`; task 5.3 names the skill, answering `P20261001-2`).

## 1. Scope against `spec.md`

No findings.

MVP item 6 is `spec.md:57-59` — "more than 14 days in APPLIED with no movement, i.e. `status =
APPLIED` and `statusChangedAt` older than 14 days". Both halves of the rule are in the delta
(`specs/kanban-board/spec.md:7-13`). The two readings of the edge are named and settled
(`design.md:65-78`), and the argument holds: `daysInStatus` floors elapsed time
(`lib/applications/status-age.ts:23-29`), so `>= 14` is "elapsed ≥ 14 × 24h", which coincides with
"older than 14 days" except at the single instant of exactly 14 days. Recording it in `spec.md` is a
task (5.1). Exclusions are stated (`proposal.md:37-39`): no filter/sort, no header count (item 7),
no reminders (out of scope, `spec.md:66`). One feature. No schema change — `statusChangedAt` already
exists (`spec.md:39`), so no `db push` obligation.

## 2. Requirement coverage and testability

- **[Major]** `P20261002-1` `specs/kanban-board/spec.md:118-121` — the scenario "Dropped in its own
  column" (a flagged card dropped on Applied is still flagged) is reached by **no task**. Task 3.1
  covers moving out of and into Applied, 3.2 the failed move, 4.3 the keyboard move out; nothing
  drops a stale card in its own column. It is also not named as untestable with compensating
  coverage. This is the design ignoring itself: `design.md:107-112` lists the own-column drop among
  the "four of the delta's scenarios … satisfied by construction" and says "they get tests because
  'satisfied by construction' is a claim about code that can change" — and `tasks.md` carries tests
  for three of the four. What it costs: the requirement "The flag follows a move" ships with one of
  its four scenarios unguarded, and a later change to the own-column path (`planCardMove` returning
  a move instead of `null`, `lib/applications/move.ts`) could reset the clock and silently unflag
  every stale card that was picked up and put down, with no failing test. The cheap form already
  exists: `e2e/days-in-status.spec.ts:168-189` does exactly this for the count, with the
  `pickUpAndDropInPlace` helper (`e2e/keyboard-move.ts:73`). Either a task that does the same on the
  seeded `e2e-applied` card, or a sentence in `tasks.md` naming that existing test plus task 2.3 as
  the compensating coverage — the author's choice; the hole is that neither is written.
- **[Minor]** `P20261002-5` `tasks.md:24-27`, `tasks.md:53-55` — the scenario "Shown without colour"
  (`specs/kanban-board/spec.md:62-65`) is about the **visible** text, but the only task that names
  an assertion on the flag's text, 2.1, asserts the *announced* (`.sr-only`) sentence. Tasks 2.3 and
  4.1 say "is flagged" without saying what is observed. An implementation whose visible pill were
  an empty amber dot with only an `.sr-only` sentence would pass 2.1 as worded. Non-blocking:
  task 2.1 specifies the visible "No movement" span, and the implementing session will almost
  certainly assert it — but "is flagged" should name the visible text as the thing 2.3/4.1 check.

Everything else maps. Requirement 1: 30 d → 1.1, 2.3, 4.1; exactly 14 → 1.1, 2.3, 4.2; 13 → 1.1,
2.3, 4.2; Wishlist 200 d → 1.1, 2.3, 4.1; other columns → 1.1, 2.3; moved into Applied today → 1.1
(0 d), 3.1; "flag agrees with count" → 1.2 (calls `daysInStatus`) plus the boundary pairs.
Requirement 2: AT announcement → 2.1; unflagged announces nothing → 2.5. Requirement 3 → 2.4.
Requirement 4: out → 3.1, 4.3; into → 3.1; failed → 3.2 (see `P20261002-2`); own column →
`P20261002-1`. Requirement 5 → 4.4 (see `P20261002-4`).

No contradiction with the main spec. `openspec/specs/kanban-board/spec.md:449-451` ("every card
shows a count, and no card shows two") is about the count; the delta's "The flag does not replace
the day count" keeps it to one count and adds a separate element, which is consistent — but see
Open question 1 on how the existing e2e test for that scenario counts.

## 3. Impact accuracy against the real code

- **[Minor]** `P20261002-3` `design.md:121-123` — "the card grows taller by wrapping before it grows
  wider" is false of the current markup. The badge row is `<p className="mt-2 flex">`
  (`components/board/ApplicationCard.tsx:183`) — `flex` with no `flex-wrap`, so `nowrap` — and both
  pills are planned `shrink-0` (`tasks.md:24`, `design.md:116-117`). Two non-shrinking items in a
  non-wrapping row do not wrap; past the content width they overflow. Task 2.1 does not add
  `flex-wrap`. Downgraded from Critical deliberately: nothing in the tasks depends on the claim, the
  real guard is task 4.4's width measurement, and at the measured widths it should fit (a ~268 px
  column, `ApplicationCard.tsx:108-109`, less `p-3.5` padding, against roughly "5000d" plus "No
  movement" at 12 px — an estimate, not a measurement). The risk stated in the design is mitigated
  by something other than what it says; either the markup or the sentence should change.

Checked and true:

- `daysInStatus(statusChangedAt, now)` is a pure function with no clock
  (`lib/applications/status-age.ts:23-29`), clamped at zero.
- `now` is a required prop with no default on the card (`components/board/ApplicationCard.tsx:49-57`,
  destructured at `:82`); `useBoardCards(applications, now)` requires it too
  (`components/board/useBoardCards.ts:61`).
- The badge row is `<p className="mt-2 flex">` holding one `shrink-0` pill, with the `aria-hidden` /
  `.sr-only` split and the name-prohibited-`generic` reasoning (`ApplicationCard.tsx:183-196`).
- The optimistic `move` sets both `status` and `statusChangedAt` (`useBoardCards.ts:38-46`), and the
  failed-move restoration of `statusChangedAt` is already tested (`useBoardCards.test.ts:457`), so
  "nothing new for the optimistic move" (`design.md:105-112`) holds.
- The 2026-10-02 contrast entry exists and is addressed to item 6 (`spec.md:277-288`).
- `e2e/long-value-layout.spec.ts` inserts a 200-character company row (`:70-87`) and a separate
  four-digit badge row (`:89-117`), and measures in both projects.
- Seed: `e2e-applied` is Applied with `statusChangedAt` 20 days before `2026-01-15T09:00Z`
  (`scripts/seed-e2e.ts:19-22, 36-43`) — about 280 days against today's wall clock, matching the
  "280d" in `proposal.md:28`; `e2e-wishlist` is Wishlist at 3 days before the same instant
  (`:26-33`), about 263 days today, matching `proposal.md:31-32`.
- The half-day offset is real (`e2e/days-in-status.spec.ts:26-50`, `extraHours = 12`), as is the
  keyboard helper task 4.3 names (`e2e/keyboard-move.ts:50`).
- "No new dependency": nothing in the tasks needs one.
- Every file in Impact is reached by a task; `spec.md`, the three component tests and the unit test
  are all named (an improvement on `P20261001-5`).

## 4. Tasks

- **[Minor]** `P20261002-2` `tasks.md:48-49` — task 3.2 asks for "a `Board` test that a card whose
  move failed is flagged again once the server list wins". A `Board` test cannot make a move fail:
  dnd-kit needs real layout, so the existing Board tests stand in for a move by re-rendering with a
  new server list (`components/board/Board.test.tsx:424-426`). A failed move's end state is the
  *original* list, so the test as worded would be a re-render with unchanged props — indistinguishable
  from a card that was never moved, and unable to fail for the reason it is named after. This
  project deleted a test of exactly that kind (`R20261001-1`, `docs/reviews/decisions.md:166`). The
  guarantee itself is held — by `useBoardCards.test.ts:152` and `:457` (the optimistic change is
  dropped and the original `statusChangedAt` restored) plus task 2.3 (the flag is a function of those
  two fields). Non-blocking because the implementing session can settle it locally; the task should
  say which of those it is relying on rather than ask for a test that cannot exist.
- **[Minor]** `P20261002-4` `tasks.md:63-66`, `design.md:116-120` — task 4.4 inserts one stale card
  *with* a 200-character name, and justifies it with the reason `e2e/long-value-layout.spec.ts:92-97`
  records — "one measurement with two possible causes could not say which of them moved a column".
  That combined row *is* the two-cause measurement the cited comment warns against: if it fails, it
  cannot say whether the name or the flag moved the column. Meanwhile the flag-alone scenario ("A
  flagged card does not move the columns", `specs/kanban-board/spec.md:128-132`) is held only
  incidentally — by the control test (`long-value-layout.spec.ts:52-67`), which will now run against
  a board containing the flagged seeded `e2e-applied` card — and no task says so. Non-blocking: a
  layout break would still fail 4.4. Either insert a stale card with an ordinary name as its own row,
  or name the control test as the flag-alone evidence.

Red-first is right: `hasNoMovement` is the only new business logic and gets a separate red task
(1.1) before green (1.2), and 1.1 can genuinely fail (the export does not exist). Tasks 2.x–3.x
describe behaviour satisfied by construction and are worded "verify with a test", not dressed as
red — `tasks.md:3-5` says why. Task 1.3 is the test that can fail for a clock-reading predicate.
Sizing and order hold; no renames; every task names its verification. The new UI element has test
tasks in jsdom and Playwright. The way out of `apply` is in order — 5.2 `npm run verify`, 5.3 the
`openspec-verify-change` skill, 5.4 the review offer — and 5.4's wording ("**Offer** … and **wait**
… a reminder to ask, not authorization to launch") cannot be read as a silent launch. Task 4.5 asks
before running the destructive `e2e:db` step.

## 5. Design decisions

No findings.

Each decision names its rejected alternative and why: a `staleness` field in the data passed down
(`design.md:60-63`, rejected on the same `JobApplication[]` argument checked last pass); a recoloured
day badge (`:86-88`, rejected, and recorded as the user's choice); an amber ring (`:90-93`, rejected
as colour-only). The inclusive edge is argued from what the card displays, not from the English,
and the residual exact-instant difference is admitted rather than hidden (`:73-75`). The contrast
decision ("darken the text, not lighten the tint") follows the `spec.md` entry addressed to this
change and is carried into task 2.2. Nothing irreversible: no schema change, no migration, no
removed guard. Every decision is reflected in tasks — except the "four scenarios get tests"
statement, which is `P20261002-1` and reported there.

## Open questions

1. `e2e/days-in-status.spec.ts:191-199` ("every card carries exactly one badge") counts elements
   whose text matches `/ in (Wishlist|Applied|Interview|Offer|Rejected)$/` and expects one per card.
   The flag's `.sr-only` sentence is not yet worded. If it ends in " in Applied" — a natural phrasing
   — that test counts the seeded `e2e-applied` card twice and fails, and the main-spec scenario it
   guards ("no card shows two", `openspec/specs/kanban-board/spec.md:449-451`) becomes ambiguous.
   Worth fixing the sentence's shape in the design, or naming that test in Impact?
2. Task 1.4 asserts `STALE_AFTER_DAYS === 14`. The boundary tests in 1.1 (13 → false, 14 → true)
   already pin the value behaviourally; is a test on the constant itself wanted, or is it
   duplication that would need editing in two places if the threshold ever moved?

## Must be revised before apply

1. **[Major]** `P20261002-1` — the delta scenario "Dropped in its own column"
   (`specs/kanban-board/spec.md:118-121`) has no task, although `design.md:107-112` promises it a
   test. Give it one, or name the existing coverage that carries it and why that is sufficient.

## Non-blocking suggestions — implementation does not depend on any of these

- `P20261002-2` — `tasks.md:48-49`: a Board test cannot drive a failed move; name the hook tests
  (`useBoardCards.test.ts:152, 457`) plus 2.3 as the coverage instead.
- `P20261002-3` — `design.md:121-123`: the badge row is `nowrap` (`ApplicationCard.tsx:183`); either
  add `flex-wrap` in 2.1 or stop claiming the row wraps.
- `P20261002-4` — `tasks.md:63-66`: the stale-plus-long-name row is itself the two-cause
  measurement it cites against; separate the flag, or name the control test as the flag-alone check.
- `P20261002-5` — `tasks.md:33-34, 53-55`: say that "is flagged" means the visible "No movement"
  text is present, not only the `.sr-only` sentence.
