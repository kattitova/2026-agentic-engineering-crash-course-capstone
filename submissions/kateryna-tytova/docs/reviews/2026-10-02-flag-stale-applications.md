# 2026-10-02 — flag-stale-applications

**Reviewer:** reviewer sub-agent (separate session; maker ≠ checker)
**Mode:** full review — first review of this change's diff
**Launched:** the prompt named the change and restated the agent definition's own procedure (resolve
scope and mode, read the ledger and earlier reviews, write a separate file with a verdict). It listed
no things to check, so the checklist below was not steered. Whether it came through
`.claude/hooks/review.mjs` is not visible from inside the session.
**Reviewed:** commits `5b3de09` (feature + unit/component tests + OpenSpec artifacts), `a109656`
(e2e, `spec.md` change log), `04ffba2` (design.md records the chosen colour pair) against
`openspec/changes/flag-stale-applications/` — `proposal.md`, `design.md`, `tasks.md`,
`specs/kanban-board/spec.md`. `16d713a` only records the proposal pass. Working tree clean apart from
the unrelated `.agent-log/actions.jsonl`.
**Verification run:** `npm run verify` — lint, `tsc --noEmit`, 13 files / 237 tests passed. The
Playwright suite was **not** run: `npm run e2e:db` issues `prisma db push --force-reset`, a write
command this role may not run. The e2e specs were read, not executed; task 4.7 records them as passing.
**Verdict:** PASS WITH NOTES — 0 critical, 0 major, 1 minor

Finding IDs continue from `R20261002-3` (the show-days-in-status review earlier today), so this file
starts at `R20261002-4`.

## Previously decided — not re-raised

| Closed item | Disposition | Why it is not raised here |
| --- | --- | --- |
| `R20260927-7` — red-then-green order cannot be read out of git history | Declined, permanently | `5b3de09` lands `status-age.test.ts` and `hasNoMovement` together. Same class, not raised. |
| 2026-09-21 §2 — commit the proposal before implementation | Deferred / closed | `5b3de09` brings all four OpenSpec artifacts into git in the same commit as the code. Same class, not raised. |
| `R20260929-3`, `R20261001-3` — commits mistyped or bundled | Accepted, not rewritten | `a109656` (`test(e2e)`) also carries the `spec.md` change-log entry and the `tasks.md` ticks. It is not a code path hidden under a `docs` type, which is the rule the ledger set; not raised. |
| `R20261001-1` — a test that cannot fail on its own assertion | Accepted (fixed by deletion) | Task 3.2 records the failed-move coverage instead of writing the unfailable Board test — the lesson applied, not reopened. |
| 2026-09-27 note — jsdom cannot tell a working `aria-hidden` / `.sr-only` split from a broken one | Author's carried note | The flag reuses that pattern; same known limit. |
| `R20261002-3` / 2026-10-02 `spec.md` entry — compute contrast against the actual tint | Accepted, addressed to this change | Cashed in by the author: `amber-800` on `amber-100`, 6.37:1, recorded in the comment, `design.md` and `spec.md`. No finding. |

No row in `decisions.md` is deferred to `flag-stale-applications` or MVP item 6.

## 1. Spec compliance

No findings.

Mapping of the delta (`specs/kanban-board/spec.md`) to code and tests:

- **Flagged in Applied at ≥ 14 whole days** — `lib/applications/status-age.ts` `hasNoMovement`:
  `status === APPLIED && daysInStatus(...) >= STALE_AFTER_DAYS`. Calls `daysInStatus`, so "nothing
  computes elapsed time a second way" holds and the flag cannot disagree with the "Nd" badge.
  30 / 14 / 13 / 0 days and the four other statuses: unit tests, `ApplicationCard.test.tsx`, and
  e2e (`stale-flag.spec.ts`, seeded `e2e-applied` vs `e2e-wishlist`, inserted 14d12h / 13d12h rows).
- **Carried by text** — visible `aria-hidden` "No movement" plus `.sr-only` "No movement for 14 days
  or more" (`ApplicationCard.tsx`, flag span). Both forms asserted in the component test; visible
  text asserted with `exact: true` in e2e. Unflagged announces nothing: `queryByText(/movement/i)`
  is null.
- **Does not replace the count** — count span untouched; test compares text and class of the count
  on a flagged and an unflagged card.
- **Follows a move** — out of Applied: Board re-render test and e2e keyboard move before and after
  reload. Into Applied: Board test with reset clock. Failed move: recorded in task 3.2 against
  `useBoardCards.test.ts`'s restore tests; I checked the reasoning holds — the flag is a pure function
  of the two restored fields. Own column: e2e `pickUpAndDropInPlace` with the stored
  `statusChangedAt` compared (this closes the proposal pass's `P20261002-1`).
- **No layout distortion** — `flex-wrap gap-1.5` on the row; two separate rows in
  `long-value-layout.spec.ts` (flag alone, flag + 200-char name), each verifying the flag is actually
  rendered before measuring.

The inclusive edge versus `spec.md`'s "more than 14 days" is recorded in the change log with its
reasoning. Nothing beyond the delta was added (no header count, no filter, no configurable threshold).

## 2. AGENTS.md compliance

No findings.

No `any` in the diff. The rule lives in `lib/applications/status-age.ts`, not in JSX. Tailwind only.
No schema change, no dependency, no `pnpm`/`yarn`. Commit messages are `type(scope): …`. The new UI
element has jsdom and Playwright tests.

## 3. Edge cases

No findings.

- **Card dragged twice quickly / stale optimistic state** — the flag is derived at render from
  `status` and `statusChangedAt`, which the existing optimistic `move` sets together; no new state is
  introduced, so there is nothing new to go stale.
- **Drop into its own column** — `planCardMove` returns `null`, no write; e2e pins that the stored
  clock is unchanged and the flag stays.
- **Deleted while in flight** — the card leaves the list; the flag goes with it. No new path.
- **Form fields** — this change does not touch any input.
- **Status outside the enum** — `hasNoMovement` compares against `APPLIED` only, so an unknown status
  returns `false`. A `statusChangedAt` in the future clamps to 0 days in `daysInStatus`; an invalid
  date yields `NaN >= 14`, which is `false`. Neither crashes or flags.
- **Hydration** — `now` is a required argument, so server and client render the same flag.

## 4. Test strength

- **[Minor]** `R20261002-4` `components/board/Board.test.tsx` — "flags the Applied cards and not the
  Interview one": the second assertion,
  `expect(interview).not.toContainElement(screen.getAllByText("No movement")[0] ?? null)`, checks only
  the *first* flag in document order. Applied renders before Interview, so `[0]` is always the
  flag on the first Applied card, and the assertion is true whatever happens on the Interview card.
  For example, a rule that flagged Interview instead of the second Applied card would still give
  two flags and pass both lines. What the user loses today: nothing. The status half of the rule is
  pinned per status in `status-age.test.ts`, `ApplicationCard.test.tsx` (`it.each` over the four
  other statuses) and e2e, so a real regression fails elsewhere. The line just reads as evidence it
  is not.

All the other new tests can fail for the reason they are named after. In particular, the
"reads its `now` argument" unit test is the one that catches a predicate with its own clock, the
`BoardColumn` test checks *which* card is flagged and not just how many, and the own-column e2e
compares the stored instant, not only the visible pill.

## 5. Input safety

No findings. Nothing in this change reads or writes `company`, `position`, `notes` or `link`; the
flag's text is a constant and the threshold a number.

## 6. Accessibility

No findings.

The flag is visible text, not colour alone (WCAG 1.4.1). It uses the badge's existing
`aria-hidden` + `.sr-only` split inside a `span`, so no name is put on a name-prohibited `generic`
role. The announced sentence says what the flag means and does not repeat the count. The contrast is
computed against the tint (6.37:1). Keyboard moving, focus and live regions are unchanged by this
diff, and the e2e move goes through the existing keyboard helper.

## 7. Consistency with earlier features

No findings. `hasNoMovement` sits beside `daysInStatus`, takes `now` the same way, imports
`ApplicationStatus` from `@/app/generated/prisma/enums` as `board.ts` and `status.ts` do, and has
explanatory doc comments in the house style. The e2e file reuses `resetBoard`, `withDatabase`,
`storedInstant` and the keyboard helpers rather than re-implementing them.

## Open questions

None.

## Blocking follow-ups

None — this change is clear to ship.

## Non-blocking suggestions — shipping does not depend on these

- `R20261002-4` — the Interview half of the first `Board` flag test checks only `[0]`, which is
  always an Applied card. Either assert on the Interview card directly or drop the line. The other
  levels already cover the behaviour.
