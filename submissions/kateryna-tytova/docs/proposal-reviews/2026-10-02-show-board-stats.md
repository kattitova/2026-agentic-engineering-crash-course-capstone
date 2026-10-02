# 2026-10-02 — show-board-stats

**Reviewer:** proposal-reviewer sub-agent (separate session; planner ≠ checker)
**Pass:** first
**Launched:** via .claude/hooks/review.mjs (neutral prompt) — the change name and a pointer to this agent definition; no list of things to check
**Reviewed:** `openspec/changes/show-board-stats/` — `proposal.md`, `design.md`, `tasks.md`, `specs/board-stats/spec.md`, `.openspec.yaml` — uncommitted (untracked; HEAD `7d6097f`)
**Structural validation:** `openspec validate show-board-stats --strict` → `Change 'show-board-stats' is valid`
**Implementation state:** not started — no task checked off; none of `lib/applications/stats.ts`, `components/board/BoardStats.tsx`, `e2e/board-stats.spec.ts` exists. The working tree carries uncommitted edits to `ApplicationCard.tsx`, `validation.ts` and their tests; they belong to `tighten-link-validation`, not to this change, and are not reviewed here.
**Verdict:** REVISE PROPOSAL — 0 critical, 1 major, 4 minor

## Previously decided — not re-raised

| Ledger entry | Why it is relevant here | Status |
| --- | --- | --- |
| `R20260927-6` — clamp/wrap assertions matched class substrings (closed 2026-10-01 in `measure-long-value-layout`) | Cited below as *evidence* for `P20261002-1` — the project's own recorded conclusion that jsdom cannot measure layout. The finding itself is not re-raised. | Closed — Accepted |
| 2026-10-02 `spec.md` entry — compute contrast against the tint actually used | The plan already carries it (task 2.5). | Closed — nothing to raise |

No Deferred entry in `docs/reviews/decisions.md` names this change or MVP item 7, so there is no deferral to cash in.

## 1. Scope against `spec.md`

No findings.

MVP item 7 (`spec.md:60-61`) asks for exactly the two figures the proposal plans; per-column
percentages, an offer rate and trends are explicitly excluded (`proposal.md:37-39`). One feature.
No `prisma/schema.prisma` change, so no `db push` is owed; the two definitional choices get a
`spec.md` change-log task (5.1).

## 2. Requirement coverage and testability

- **[Major]** `P20261002-1` `specs/board-stats/spec.md:260-263`, `tasks.md:93-96`, `design.md:179-182` —
  the scenario "Large figures do not distort the board" has no coverage that can fail. Task 4.1
  assigns it to a *component-level* test asserting the region "renders without overflowing" and
  "wraps rather than forcing horizontal scroll". Component tests run under Vitest with
  `environment: "node"` and per-file jsdom (`vitest.config.mts:13-14`). jsdom has no layout engine,
  and this project has already recorded that conclusion and acted on it: `decisions.md:31` and
  `decisions.md:175-211` (`R20260927-6`) removed the `break-words`/`line-clamp-` substring assertions
  because they "could not fail for any reason the spec cares about". Implemented as written, 4.1
  can only be met by that same kind of class-substring assertion, which is exactly what
  `measure-long-value-layout` deleted. The other half of the justification is a tooling claim that
  does not hold: "a four-digit total needs a thousand seeded rows, so the e2e suite cannot reach
  it". The e2e suite already inserts rows straight into `e2e.db` with better-sqlite3
  (`e2e/long-value-layout.spec.ts:102-117`, the four-digit *day count* case). `resetBoard` deletes
  every row and restores the snapshot in one transaction (`e2e/reset-board.ts:46-52`), so a thousand
  inserts inside one `db.transaction` use the same mechanism, and cleanup costs nothing extra.
  Task 4.2 does not cover the scenario either: it measures the seeded board, whose total is 3.
  **What this costs:** the implementing session reaches 4.1 and finds it cannot write a test that
  fails for this requirement, so it has to replan. Otherwise the requirement ships with a test that
  reads as evidence but isn't, which the ledger has already called worse than no test
  (`decisions.md:166`).

- **[Minor]** `P20261002-3` `specs/board-stats/spec.md:115-118` — the scenario "The first
  application" (from empty to one application, then a percentage measured against that one) is
  reached by no task. Task 1.1 has no case with a total of exactly 1 (whether "an Offer alone"
  means a one-row board is ambiguous). No board-level or e2e task adds an application to an empty
  board. The pure function makes a regression unlikely, but naming a one-row case in 1.1 would
  close it.

- Under **Open questions**, not as a finding: the scenario "An abbreviation is not what is
  announced" (`spec.md:237-240`) is conditional, and `design.md:144-153` rules out any abbreviation,
  so as written the scenario can never be tested.

## 3. Impact accuracy against the real code

All load-bearing claims hold:

- `Board` derives `grouped = groupApplicationsByStatus(shown)` — `components/board/Board.tsx:153`;
  `shown` comes from `useBoardCards` — `Board.tsx:91`, `useOptimistic` at
  `components/board/useBoardCards.ts:64`.
- `applyChange`'s `remove` branch filters the row and its `move` branch rewrites `status` —
  `useBoardCards.ts:31-44`.
- `groupApplicationsByStatus` drops unrecognised statuses and returns every key —
  `lib/applications/board.ts:45-63`; `ApplicationsByStatus` is exported at `board.ts:35`.
- The failure `role="alert"` paragraph sits before the column grid — `Board.tsx:171-183`.
- `app/page.tsx` is an async Server Component that only holds the server list and `now` —
  `app/page.tsx:5-24`.
- `BoardColumn`'s `aria-hidden`/`.sr-only` pair and its template-literal comment, which task 2.4
  points to — `components/board/BoardColumn.tsx:61-64`.
- The e2e seed is 3 rows (Wishlist, Applied, Interview) — `scripts/seed-e2e.ts:24-55` — so
  33% → 67% in task 4.3 is right. The suite runs `workers: 1` against one database —
  `playwright.config.ts:9-10`.
- The deferred-promise action mock that task 3.2 asks for already has a precedent —
  `components/board/Board.test.tsx:17, 89`.
- No overlap with `tighten-link-validation` on `Board.tsx`. That change mentions
  `e2e/long-value-layout.spec.ts` only as context (`tighten-link-validation/design.md:123`) and
  does not edit it.

- **[Minor]** `P20261002-4` `proposal.md:56-76` — Impact leaves out files that tasks touch:
  `lib/applications/stats.test.ts` (1.1), the `BoardStats` test file (2.x),
  `components/board/Board.test.tsx` (3.x), `e2e/long-value-layout.spec.ts` (4.2) and the new
  `e2e/board-stats.spec.ts` (4.3). Mostly bookkeeping. The `long-value-layout.spec.ts` omission
  matters a little, because "the two can proceed in parallel" (`proposal.md:73-76`) is argued from
  the list of files touched.

## 4. Tasks

- **[Minor]** `P20261002-2` `tasks.md:27-36` — tasks 1.3 and 1.4 add business-logic tests *after*
  1.2 has made the module green. Task 1.4 says itself that 1.1's "not 0 / not 100" assertions would
  pass an implementation returning `0.5`/`99.5`. So the exact clamp values (`1`, `99`) are first
  pinned by a test that is never seen red, which is the order `AGENTS.md` → Tests rules out. The
  sensible fix is to fold 1.4's exact values and 1.3's unknown-status case into 1.1. Separately,
  1.3's stated purpose ("the exclusion must come from `groupApplicationsByStatus` and not from a
  second filter") cannot be checked by a test: a second filter inside `summariseBoard` would pass
  the same assertion. What holds that guarantee is the parameter type, not the test.
- **[Minor]** `P20261002-5` `tasks.md:100-104` — task 4.3 moves a seeded card and reloads, which
  leaves `e2e.db` changed. With one worker and a shared database (`playwright.config.ts:8-10`), a
  later spec would see two Interview cards. The task doesn't say to restore the board with
  `resetBoard()` after the test, as the other mutating specs do (`e2e/edit-and-delete.spec.ts:58-60`).
  The implementing session will probably follow that convention, but the task should say so.

The exit order is right: 5.2 `npm run verify` → 5.3 `openspec verify` → 5.4 reviewer. Task 5.4 is
worded as an offer that waits for an answer, names the launcher and forbids extra prompt content.
No finding there.

## 5. Design decisions

No findings beyond `P20261002-1`, whose tooling claim (`design.md:179-182`) is reported under §2
where it is most actionable. Each decision names the alternative it rejected:

- Interview + Offer vs. adding Rejected vs. a transition log
- denominator with or without Wishlist
- grouped record vs. flat list
- `null` vs. `0`
- round + clamp vs. one decimal vs. floor
- visible text vs. an `sr-only` pair vs. `<dl>`

The irreversible-looking part — the permanent undercount — is named and carried into on-screen
wording (2.2) and into `spec.md` (5.1).

## Open questions

- `spec.md:237-240` "An abbreviation is not what is announced": with no abbreviation by design,
  should the scenario stay as a guard for later edits, or be dropped? If it stays, nothing tests it.
- The "nothing yet" wording for the empty board (task 2.3) is not fixed anywhere. That is fine to
  settle while implementing, but tasks 2.3 and 4.x will want to assert the exact string.

## Must be revised before apply

1. `P20261002-1` (Major) — give "Large figures do not distort the board" a check that can fail.
   Revisit the claim that e2e cannot seed a four-digit total, and drop or reword the jsdom-level
   "does not overflow / wraps" test in task 4.1.

## Non-blocking suggestions (implementation does not depend on these)

- `P20261002-2` — fold 1.3/1.4's exact assertions into the red task 1.1.
- `P20261002-3` — add a one-application case for "The first application".
- `P20261002-4` — list the test and e2e files in Impact.
- `P20261002-5` — say that 4.3 restores the seeded board afterwards.
