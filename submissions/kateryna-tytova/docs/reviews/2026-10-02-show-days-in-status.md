# 2026-10-02 — show-days-in-status

**Reviewer:** reviewer sub-agent (separate session; maker ≠ checker)
**Mode:** full review — first review of this change's diff
**Launched:** as a sub-agent; the prompt named the change and restated the agent definition's own
procedure (resolve scope and mode, read the ledger and earlier reviews, write a separate file with a
verdict). It listed no things to check, so the checklist below was not steered.
**Reviewed:** commits `283453a`, `b5ff9d5`, `7072205`, `8af9a90` (and `e832af4`, which only records
the proposal review) against `openspec/changes/show-days-in-status/` — `proposal.md`, `design.md`,
`tasks.md`, `specs/kanban-board/spec.md`. Working tree clean apart from the unrelated
`.agent-log/actions.jsonl`.
**Verification run:** `npm run verify` — lint, `tsc --noEmit`, 13 files / 212 tests passed. The
Playwright suite was **not** run: `npm run e2e:db` issues `prisma db push --force-reset`, which is a
write command this role may not run. The e2e specs were read, not executed; tasks 4.7 and 5.6 record
them as passing.
**Verdict:** PASS WITH NOTES — 0 critical, 0 major, 3 minor

## Previously decided — not re-raised

| Closed item | Disposition | Why it is not raised here |
| --- | --- | --- |
| `R20260927-7` — red-then-green order cannot be read out of git history | Declined, permanently | `283453a` lands `status-age.test.ts` and `status-age.ts` together, as does `b5ff9d5` for the hook test and the hook. Same class, not raised. |
| `R20260929-3`, `R20261001-3` — specific commits mistyped or bundled | Accepted, not rewritten | Those commits are not re-raised. `R20261002-1` below is about new commits in this diff. |
| `R20260927-6` — clamp/wrap assertions match class substrings | Closed 2026-10-01 | The new layout row in `long-value-layout.spec.ts` measures, it does not match classes. |
| 2026-09-27 note — the jsdom test for an `aria-hidden` / `.sr-only` split cannot tell a working accessibility tree from a broken one | Author's carried note | The badge reuses that pattern on purpose; its jsdom tests carry the same known limit. |
| 2026-09-27 §4 — "read per request, not per build" has no automated guard | Deferred, answer recorded | Nothing defers to this change. The new e2e "shows a higher count…" happens to exercise it, but that is not a cash-in. |

No entry in `docs/reviews/decisions.md` defers to `show-days-in-status`, so there is nothing to cash in.

## 1. Spec compliance

No findings.

Each delta requirement maps to code and to at least one test:

| Requirement / scenario | Code | Evidence |
| --- | --- | --- |
| Whole elapsed days, 12 days / under a day / exactly one / 20 h across a date | `lib/applications/status-age.ts:23-29`, `:53-63` | `status-age.test.ts:12-31`, `:61-83`; card tests; e2e `days-in-status.spec.ts:75-132` |
| One instant per request, same moment for every card | `app/page.tsx` (`const now = new Date()`), required `now` prop in `Board`, `BoardColumn`, `DraggableCard`, `ApplicationCard` with no default | `BoardColumn.test.tsx` "counts every card… same instant", `Board.test.tsx` "same count for two cards" |
| Never negative | `status-age.ts:25` (`elapsed <= 0 → 0`) | unit test `:33-38`, card test "stored moment is in the future" |
| Large count does not distort the board | badge on its own row, `shrink-0 tabular-nums` (`ApplicationCard.tsx:183-192`) | measured, both viewports: `long-value-layout.spec.ts` "a four-digit day count…" (closes the proposal review's `P20261001-1`) |
| Every card has one badge, never two | unconditional render in `ApplicationCard` | `BoardColumn.test.tsx`, e2e "every card carries exactly one badge" |
| Announced as a length of time naming the status; abbreviation not announced | `aria-hidden` short + `.sr-only` full; label from `BOARD_COLUMNS` | card tests; e2e `toBeAttached` on the full form |
| Named status follows the card | label derived from `application.status` at render | `Board.test.tsx` "announces a moved card with the column it is now in" |
| Move resets the badge, survives reload, failed move restores, same-column drop untouched | `useBoardCards.ts` `move` branch stamps `statusChangedAt: change.at` | hook tests `:412-498`; e2e move + reload + stored-value check; e2e drop-in-place with stored value compared |
| Badge reflects the served instant; reload shows a higher count | no clock below `page.tsx` | e2e "shows a higher count once the card has been in its status longer" |

Nothing exists without a requirement behind it. MVP item 6 is not started: no threshold, no stale styling.
The `spec.md` change-log entry (task 5.4) is present, dated, and names the change. No schema change.

## 2. AGENTS.md compliance

- **[Minor]** `R20261002-1` commits `7072205`, `8af9a90` — "one commit = one logical change" is
  bent twice. `7072205` (`test(e2e): …`) adds the new days-in-status specs, also extracts the
  keyboard-move helper out of `move-card.spec.ts` into `e2e/keyboard-move.ts` (a refactor of an
  unrelated spec), and also changes how `long-value-layout.spec.ts` writes dates. `8af9a90` is
  typed `docs(openspec)` but adds a 25-line e2e test, which is the exact pattern the ledger's own
  forward rule after `R20261001-3` says to stop ("a commit that touches a code path does not get
  a `docs` type"). What the author loses: bisecting a `move-card.spec.ts` flake lands on a commit
  described as adding badge tests, and a `docs`-filtered log hides a test. No behaviour is wrong.

Checked and clean: no `any` in the new or changed files; the logic (`daysInStatus`,
`describeDaysInStatus`) lives in `lib/applications/`, not in JSX; Tailwind classes only; no
schema change; npm only; every new UI behaviour has tests at the component and e2e levels; commit
messages follow `type(scope): description`.

## 3. Edge cases

No findings.

Reasoned through explicitly:

- **Two fast drags of the same card** — unchanged by this diff: the handle is disabled while the
  card's write is in flight (`isCardBusy`). Each optimistic move stamps the same served instant,
  so there is no ordering in which the badge could show a value newer than the stored one. One
  narrow case was traced and is harmless: if another action's revalidation delivers a new `now`
  while a move is still in flight, the reducer re-applies the move with the *old* stamp against
  the *new* `now`, so on a page served more than 24 h earlier the moving card could read "1d" for
  the length of the write; the move's own revalidation then replaces it with the stored value.
  Transient, and only on a day-old page.
- **Drop in its own column** — `planCardMove` returns `null`, no `moveCard`, no stamp. Pinned by
  e2e comparing the stored `statusChangedAt` before and after (`days-in-status.spec.ts:164-185`).
- **Deleted while in flight** — the `remove` branch filters and never rewrites; tested
  (`useBoardCards.test.ts` "does not touch statusChangedAt when a card is deleted").
- **Empty / whitespace / very long form values** — no new input. Very long *counts* are measured.
- **Status outside the enum** — such rows are already left off the board; `statusLabel`'s `?? status`
  fallback cannot be reached from a rendered card and cannot throw.
- **Future `statusChangedAt`** — clamps to "Today"; unit, component tests.
- **Hydration** — `now` crosses the RSC boundary as a `Date` and both renders use it; there is no
  `new Date()` below `page.tsx`, and the required prop makes adding one at a call site a type error.

## 4. Test strength

- **[Minor]** `R20261002-2` `e2e/days-in-status.spec.ts:113-119` — the comment says "20 hours is a
  previous calendar date", and the test is presented as the e2e form of the scenario "A day
  boundary is not a calendar boundary". The row is aged relative to `Date.now()`, so it lands on
  the previous UTC date only when the run happens before 20:00 UTC; a run after that inserts a
  same-date moment and the test checks only "under a day reads Today". The scenario is still pinned
  by `lib/applications/status-age.test.ts:24-31`, which uses fixed instants, so nothing is
  uncovered — the e2e comment simply claims more than it measures on some runs.

Mutation reasoning on the rest, all of which would fail if the logic were inverted or removed:
`daysInStatus` ignoring `now` (caught by `status-age.test.ts:48-57`), dropping the clamp (`:33-38`),
`Math.round` instead of `floor` (`:20-22`), dropping the singular (`:71-76`), the reducer not
stamping (`useBoardCards.test.ts` "resets statusChangedAt…"), the reducer stamping every card
("leaves every other card's statusChangedAt alone"), a stale status label (`Board.test.tsx` move
test), a clock reset on a same-column drop (stored-value comparison in e2e). The large-badge layout
test asserts the 5000d badge is visible before measuring, so it cannot pass on a board that dropped
the row.

## 5. Input safety

No findings. The change adds no write path and no field; it reads `statusChangedAt` and `status`,
both of which are handled for out-of-range values (future instant, unknown status) above.

## 6. Accessibility

- **[Minor]** `R20261002-3` `components/board/ApplicationCard.tsx:184` — the visible badge is
  `text-xs font-medium text-slate-500` on `bg-slate-100`. Using the sRGB equivalents of those
  Tailwind colours (≈ `#64748b` on `#f1f5f9`) the contrast ratio is about 4.35:1, below the
  4.5:1 WCAG AA minimum for 12 px text. Computed, not measured in a browser; Tailwind 4's oklch
  values are close to but not identical to those hex values. A low-vision sighted user loses
  some legibility of the count; screen-reader users are unaffected because the announced form is
  the `.sr-only` text. The column count it was modelled on uses the same text colour on
  `bg-white`, which passes (≈ 4.76:1).

Checked and clean: the announced form names the status and is real text, not an `aria-label` on a
`generic` span; the abbreviation is `aria-hidden`; the badge is not focusable and adds no control
to the keyboard path; the keyboard move and focus restoration are unchanged and exercised by the
new e2e move test.

## 7. Consistency with earlier features

No findings. The new module follows the `lib/applications/` layout and comment style; the label
comes from `BOARD_COLUMNS` rather than a new table; the `aria-hidden` + `.sr-only` split matches
`BoardColumn`'s count; no new server action, so `ActionResult` does not come up; the e2e date
helpers are centralised in `e2e/reset-board.ts` next to `withDatabase`.

## Open questions

- Nothing automated asserts that the page hydrates without a mismatch warning — the design's central
  goal is held by the type system (required `now`, no default) rather than by a test that listens for
  React's hydration error in the browser console. That may well be enough; it is the author's call.

## Blocking follow-ups

None — this change is clear to ship.

## Non-blocking suggestions (shipping does not depend on these)

- `R20261002-1` — keep refactors of other specs and `docs`-typed commits free of test code.
- `R20261002-2` — make the 20-hour e2e comment say what it actually guarantees, or pin the
  calendar-boundary case only in the unit test.
- `R20261002-3` — the badge's text/background contrast is just under AA for 12 px text.
