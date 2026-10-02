# Tasks

`daysInStatus`, `describeDaysInStatus` and the optimistic reset are new business logic, so each is
written red-first: the task that writes the test says "(red)" and is separate from the task that
makes it pass. The badge and the threading are UI; those tasks state the assertion the test must
make, and the component and its test land together.

## 1. The day count, as a pure function

- [x] 1.1 Write failing tests (red) for `daysInStatus(statusChangedAt, now)` in
      `lib/applications/status-age.test.ts`: 12 whole days → 12; exactly 24 hours → 1; 23 hours 59
      minutes → 0; 20 hours ago but on the previous calendar date → 0, which is the case that
      separates elapsed days from calendar days; `now` earlier than `statusChangedAt` → 0, never
      negative; several thousand days → that number. Verify every one fails before the module exists
- [x] 1.2 Write `lib/applications/status-age.ts` with `daysInStatus` taking two `Date`s and holding
      no `new Date()` of its own, and verify the tests from 1.1 pass
- [x] 1.3 Write failing tests (red) for `describeDaysInStatus(days, statusLabel)`: 0 → short
      "Today", full "Today in Interview"; 1 → short "1d", full "1 day in Interview" (singular, not
      "1 days"); 12 → short "12d", full "12 days in Interview". Verify they fail first
- [x] 1.4 Implement `describeDaysInStatus`, taking the label from `BOARD_COLUMNS` at the call site so
      the badge does not invent a sixth spelling of a status name, and verify 1.3 passes
- [x] 1.5 Verify with a test that `daysInStatus` actually reads its `now` argument: two different
      `now` values against one `statusChangedAt` give different answers. Asserting that the same two
      instants give the same answer was written first and dropped — it passes for a function that
      ignores `now` entirely and calls the clock itself, which is the one defect worth catching here

## 2. A moved card reads as newly arrived

- [ ] 2.1 Write a failing test (red) in `useBoardCards.test.ts` asserting that the optimistic `move`
      change sets `statusChangedAt` to the served instant as well as `status`, so the moved card's
      count is zero before the write settles. Verify it fails first
- [ ] 2.2 Add the served instant to the hook and set `statusChangedAt` in `applyChange`'s `move`
      branch, and verify 2.1 passes with every existing move and deletion test untouched
- [ ] 2.3 Verify with a test that a failed move restores the original `statusChangedAt` — the
      optimistic change is dropped and the server list wins — so the badge goes back with the card
- [ ] 2.4 Verify with a test that the `remove` branch leaves `statusChangedAt` alone, so the merged
      reducer did not acquire a second side effect

## 3. The instant reaches the card

- [ ] 3.1 Have `app/page.tsx` take the instant once per request and pass it to `Board`, threaded
      through `BoardColumn` and `DraggableCard` to `ApplicationCard` as a **required** prop with no
      default at any level. Verify `npx tsc --noEmit` passes and that the four existing test files
      (`Board.test.tsx`, `BoardColumn.test.tsx`, `ApplicationCard.test.tsx`, `useBoardCards.test.ts`)
      were each updated to pass an explicit instant. A `now = new Date()` default would type-check,
      keep every one of those green, and put a clock back inside a component that renders twice —
      which is the single failure this design exists to prevent, so the absence of a default is the
      thing to check, not just that it compiles
- [ ] 3.2 Verify with a test that `BoardColumn` passes the same instant to every card it renders, so
      two applications whose statuses changed at the same moment show the same number
- [ ] 3.3 Verify with a `Board` test that two cards whose `statusChangedAt` are equal show the same
      count, and that a card whose `statusChangedAt` is 12 days before the instant shows 12 — the
      scenario "every card is counted against the same moment", asserted at the board rather than
      assumed from the prop

## 4. The badge

- [ ] 4.1 Add the badge to `ApplicationCard` on its own row below the position, `shrink-0` with
      `tabular-nums`, showing `short` in a `aria-hidden` span and `full` in an `.sr-only` span —
      the pattern `BoardColumn`'s count already uses, because an `aria-label` on a bare span sits on
      a name-prohibited role. Verify `ApplicationCard.test.tsx` asserts the announced text is the
      full form naming the status ("12 days in Interview") and not the abbreviation
- [ ] 4.2 Verify with tests that the card shows "Today" for under a day, a singular day for exactly
      one, and the plain count for 12
- [ ] 4.3 Verify with a test that a card whose stored `statusChangedAt` is after the instant renders
      and reads as today rather than showing a negative number
- [ ] 4.4 Verify with a `Board` test that a card moved to another column is announced with the name
      of the column it is now in, not the one it came from — the announced status is derived from
      where the card is, so a stale label would be the badge contradicting its own column
- [ ] 4.5 Verify with a test that a card whose count is four digits still renders the badge, and
      with `BoardColumn.test.tsx` that every card in a column has exactly one badge
- [ ] 4.6 Extend `e2e/long-value-layout.spec.ts` with a second inserted row — an ordinary company
      name and `statusChangedAt` several thousand days back — and verify the column widths are
      unchanged and the page does not scroll sideways with that badge on the board. A separate row
      from the long-company one on purpose: that spec's own control test records why one measurement
      with two possible causes cannot say which of them moved the column. This is the measurement
      the delta scenario "A very large count does not distort the board" asks for; the existing
      long-name row sets `statusChangedAt` to now, so its badge reads "Today" and proves nothing
      about a wide one
- [ ] 4.7 Run `npm run test:e2e -- long-value-layout` and verify both viewports pass, the original
      long-name measurement included. This needs `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION`,
      because `npm run e2e:db` issues `prisma db push --force-reset`; ask the user before running it

## 5. End to end and record-keeping

- [ ] 5.1 Add an e2e case that inserts its own row aged exactly 12 days and 12 hours and asserts the
      badge reads 12 days. Not computed from a seeded row: those sit on 09:00:00Z, and the test
      process's clock and the server's request instant floor against that same edge, so a run
      straddling 09:00 UTC disagrees by one. A controlled half-day offset puts the flooring boundary
      twelve hours from either clock, so the expectation holds whenever the run happens — and a
      hardcoded number against the fixed seed would be wrong by one more every day
- [ ] 5.2 Add an e2e case that moves a card with the keyboard and verifies its badge reads as today
      in the new column without a reload, and still does after one
- [ ] 5.3 Add an e2e case that drops a card on its own column and verifies its badge is unchanged,
      which is the observable half of "the clock was not reset"
- [ ] 5.4 Add the `spec.md` change-log entry recording that the count is whole elapsed days computed
      server-side, why calendar days were not used, and that MVP item 6 will threshold the same
      function. Verify the entry is dated and names this change
- [ ] 5.5 Run `npm run verify` and verify it passes with no errors
- [ ] 5.6 Run the full `npm run test:e2e` and verify it passes, asking the user first for the same
      reason as 4.7
- [ ] 5.7 Run the `openspec-verify-change` skill (`/opsx:verify show-days-in-status`) and fix
      anything it reports, so the cheap mechanical gate has run before any review session is spent.
      It is a skill, not a CLI command — `openspec` itself offers only `validate`, `status` and
      `doctor`, and `openspec verify` would simply fail
- [ ] 5.8 **Offer** the user an independent `reviewer` pass on the diff and **wait for their
      answer**. Do not launch it unprompted — this task is a reminder to ask, not authorization.
      If they accept, record the outcome under `docs/reviews/` and index it in `docs/review-log.md`;
      if they decline, that is their call and nothing is recorded
