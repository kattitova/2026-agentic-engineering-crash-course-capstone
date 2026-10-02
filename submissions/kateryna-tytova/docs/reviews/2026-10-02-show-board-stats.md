# 2026-10-02 — show-board-stats

**Reviewer:** reviewer sub-agent (separate session; maker ≠ checker)
**Mode:** full review (no earlier review of this change exists)
**Launched:** the prompt gave the change name plus procedural instructions that restate this
agent's own definition (resolve scope and mode, read the ledger, write one file, give a verdict).
It listed **no** things to check, so the checklist below was not steered.
**Reviewed:** uncommitted working tree against `HEAD` (`e2fa2b6`). Nothing of this change is
committed, artifacts included: new `lib/applications/stats.ts` + `stats.test.ts`,
`components/board/BoardStats.tsx` + `BoardStats.test.tsx`, `e2e/board-stats.spec.ts`; modified
`components/board/Board.tsx`, `Board.test.tsx`, `useBoardCards.test.ts`,
`e2e/long-value-layout.spec.ts`, `spec.md`. The untracked `openspec/changes/move-card-by-menu/`
is a different change and was not reviewed.
**Verification run:** `npm run verify` — lint, `tsc --noEmit` and Vitest all pass (15 files,
282 tests). `npm run test:e2e` was **not** run: `npm run e2e:db` issues
`prisma db push --force-reset`, a write this role may not perform. The e2e claims below are read
from the code, not observed.
**Verdict:** PASS WITH NOTES — 0 critical, 0 major, 2 minor

## Previously decided — not re-raised

| Item | Ledger status | Why it is not raised here |
| --- | --- | --- |
| `R20260927-6` — layout asserted through class substrings | Closed 2026-10-01 | This change honours it: no jsdom layout assertion; widths measured in Playwright. |
| `R20260927-7` — red-then-green order not readable from git history | Declined | Same class applies here (nothing is committed, so order cannot be read), not re-raised. |
| 2026-09-27 §2 — the change was entirely uncommitted | Accepted | This change is also uncommitted at review time; recorded in the header, not as a finding. |
| 2026-09-21 §3/§5 — unbounded field lengths | Resolved in `add-application` | No write path touched by this change. |

## 1. Spec compliance

Every requirement in `specs/board-stats/spec.md` maps to code and to at least one test:

| Requirement | Code | Evidence |
| --- | --- | --- |
| Total, agrees with cards, singular, zero | `stats.ts:49-53`, `BoardStats.tsx:688-690` | `stats.test.ts`, `Board.test.tsx` "counts the cards…", `BoardStats.test.tsx` wording block |
| Share = Interview + Offer over all, legible counted set | `stats.ts:32-35, 55-58`, `BoardStats.tsx:697-715` | 15/2/1 → 20, 10/1 → 10, Rejected not counted, "Interview or Offer" text tests |
| Empty board: no percentage, not 0%, still shown | `stats.ts:80-82`, `BoardStats.tsx:688, 697` | `null` type, `not.toContain("%")` at component and board level |
| Whole number, clamped | `stats.ts:84-91` | exact `1` for 1/201, exact `99` for 200/201 |
| Unknown status out of both figures | `summariseBoard` takes `ApplicationsByStatus` | unit and board tests with an `ARCHIVED` row |
| Follows move / deletion, reverts on failure | `Board.tsx:196` from `grouped` ← `shown` | deferred-deletion board test (would fail if computed from the server list), hook tests for move and failed move, e2e keyboard move + reload |
| Announced as what they mean | written-out text, no `sr-only` twin | `BoardStats.test.tsx` "nothing here is abbreviated" |
| Above the board, no distortion, narrow viewport | `Board.tsx:196` before the alert and grid | `compareDocumentPosition` test; e2e width/scroll in `wide` and `wrapped` (1100px) projects |

No code without a requirement behind it. The rejection sentence under the percentage is what the
"counted set legible" requirement asks for.

- **[Minor]** `R20261002-7` `openspec/changes/show-board-stats/tasks.md` (task 3.5) and
  `proposal.md` (Impact) — task 3.5 is checked as "board-level tests that a failed **move** and a
  failed deletion leave both figures", but the failed-move half lives in
  `components/board/useBoardCards.test.ts:250-270` (a hook test), for the same jsdom-layout reason
  task 3.2's revision records; 3.5 carries no such revision note. Correspondingly, the Impact
  section does not list `useBoardCards.test.ts` as modified. Behaviour is covered; what is lost is
  that a reader of the artifacts looks for a board-level failed-move test that does not exist —
  the drift class `openspec verify` is there to catch.

## 2. AGENTS.md compliance

No findings.

## 3. Edge cases

No findings. Reasoned through: two quick drags and a drop into the same column change nothing
specific to this region — the figures are a pure function of `shown`, so they are exactly as right
as the optimistic list already is. A deletion in flight is covered by the deferred-deletion test.
Form fields are not touched. An unknown stored status is excluded upstream by
`groupApplicationsByStatus`, and the type carries that guarantee (task 1.3). The clamp branches
cannot fire for `total < 200` and cannot both fire at once.

## 4. Test strength

Mutations reasoned against the new tests: computing the summary from `applications` instead of
`shown` fails "re-measures both figures before a deletion's write settles" (the server list stays
at three); adding `REJECTED` to `REACHED_INTERVIEW` fails the Rejected unit test; dropping either
clamp fails the exact `1` / `99` cases; returning `0` instead of `null` fails the type check and
the `%`-absence tests; removing the `percentReachedInterview !== null` guard fails the same.

- **[Minor]** `R20261002-8` `e2e/long-value-layout.spec.ts:350-369` — the delta scenario "Large
  figures do not distort the board" says every column keeps its **width and position**; the
  four-digit test compares widths and horizontal scroll only, never a column's `x`/`y`. A summary
  that wrapped onto extra lines at four digits and pushed the grid down would pass. Low impact
  today — the figures are short and the note line already takes its own row via `basis-full` — but
  the scenario's second clause has no assertion behind it.

## 5. Input safety

No findings. The region renders only numbers derived from counts and fixed strings; no stored
value reaches it.

## 6. Accessibility

No findings. The region is a `<section>` with `aria-label`, so it is a named landmark; the figures
are visible text in the tree with no `aria-hidden`/`sr-only` split; it precedes the columns in DOM
order. Contrast is on a white surface and recorded in a comment (`BoardStats.tsx:675-680`).

## 7. Consistency with earlier features

No findings. `lib/applications/` layout, pure function with a typed record argument, the
`readonly ApplicationStatus[]` list matches `COLUMN_ORDER` in `board.ts`, the one-template-literal
pluralisation matches `BoardColumn.tsx:64`, and the e2e file follows the `beforeEach`/`afterAll`
`resetBoard` pattern.

## Open questions

- The figures change silently after a move or deletion — the region is not a live region. That
  matches the spec (which asks for the figures to be *readable* as what they mean, not announced on
  change), and making it live would add an announcement to every move. Worth a deliberate yes/no
  from the author rather than leaving it implicit.

## Blocking follow-ups

None — this change is clear to ship.

## Non-blocking suggestions (shipping does not depend on these)

- `R20261002-7` — add a revision note to task 3.5 and list `useBoardCards.test.ts` in Impact.
- `R20261002-8` — the four-digit e2e case does not assert column position, only width.
