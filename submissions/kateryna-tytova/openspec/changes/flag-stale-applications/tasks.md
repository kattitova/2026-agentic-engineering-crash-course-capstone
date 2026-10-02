# Tasks

`hasNoMovement` is new business logic, so it is written red-first: 1.1 writes the test and 1.2 makes
it pass. Nothing else here is new logic — the optimistic move already sets both fields the rule reads
— so the remaining tasks say what the test must assert and land the component with its test.

## 1. The rule, as a predicate

- [x] 1.1 Write failing tests (red) for `hasNoMovement(application, now)` in
      `lib/applications/status-age.test.ts`: Applied at 30 days → true; Applied at exactly 14 days →
      true; Applied at 13 days → false; Applied at 0 days → false; Wishlist, Interview, Offer and
      Rejected each at 200 days → false. Verify every one fails before the function exists
- [x] 1.2 Add `hasNoMovement` and `STALE_AFTER_DAYS` to `lib/applications/status-age.ts`, calling
      `daysInStatus` rather than subtracting dates again, and verify 1.1 passes
- [x] 1.3 Verify with a test that the predicate reads its `now` argument: one application and two
      different `now` values, one before the threshold and one after, give false then true. A
      predicate that called a clock of its own would pass every test in 1.1, which all share one
      instant

## 2. The flag on the card

- [x] 2.1 Add the second badge to `ApplicationCard`'s existing badge row — `shrink-0`, visible
      "No movement" in an `aria-hidden` span and `"No movement for 14 days or more"` in an `.sr-only`
      span, the same split the day count uses. Add `flex-wrap` and a gap to that row: it is
      `<p className="mt-2 flex">` today, so two `shrink-0` children do not wrap, they overflow once
      they exceed the content width. Verify `ApplicationCard.test.tsx` asserts **both** the visible
      "No movement" text and the announced sentence — an empty amber pill carrying only `.sr-only`
      text would satisfy an assertion on the announced form alone, and the spec's "shown without
      colour" scenario is about the visible text
- [x] 2.2 Compute the text/background contrast ratio for the chosen amber pair **before** writing
      the classes, against the tint the text will actually sit on, and record the figure in a
      comment. Verify it is at least 4.5:1 for 12px text with margin for Tailwind 4's oklch values;
      if it is not, darken the text rather than lightening the tint, so the pill stays
      distinguishable from the neutral badge beside it
- [x] 2.3 Verify with tests that a card in Applied at 30 days and at exactly 14 days shows the
      visible "No movement" text, and that one at 13 days, one at 0 days, and old cards in each of
      the other four statuses do not. "Flagged" means that text is present, not merely that some
      amber class was applied
- [x] 2.4 Verify with a test that a flagged card still shows its day count, and that the count's own
      text and styling are identical on a flagged and an unflagged card — only the flag distinguishes
      them
- [x] 2.5 Verify with a test that an unflagged card renders no movement text at all, so nothing
      about movement is announced for it
- [x] 2.6 Verify with `BoardColumn.test.tsx` that a column holding one stale and one fresh Applied
      card flags exactly one of them

## 3. The flag across a move

- [x] 3.1 Verify with a `Board` test that a flagged card re-rendered in Interview is no longer
      flagged, and that a card moved into Applied with a reset clock is not flagged — both halves of
      the rule, driven by the two fields the optimistic move already sets
- [x] 3.2 Record, rather than test at the board, that a failed move leaves the card flagged — and
      verify the coverage it rests on actually exists: `useBoardCards.test.ts`'s "drops the optimistic
      move and reports the failure" and "restores the original statusChangedAt when the move fails"
      pin that both fields go back, and task 2.3 pins that the flag is a function of those two
      fields. A `Board` test cannot drive a failed move — dnd-kit needs real layout, so the existing
      Board tests stand in for a move by re-rendering with a new server list, and a failed move's end
      state *is* the original list. The test would be a re-render with unchanged props,
      indistinguishable from a card that was never moved, and unable to fail for the reason it is
      named after. This project has already deleted a test of that kind (`R20261001-1`)

## 4. End to end

- [x] 4.1 Add an e2e case asserting the seeded `e2e-applied` card (Applied, far past the threshold)
      shows the visible "No movement" text and that `e2e-wishlist` (Wishlist, also old) does not —
      the positive and the negative the rule most easily gets wrong, both already in the seed
- [x] 4.2 Add e2e cases for the boundary with rows the spec inserts at a controlled age: Applied at
      14 days and 12 hours is flagged, Applied at 13 days and 12 hours is not. Use the half-day
      offset `days-in-status.spec.ts` already uses, so the flooring boundary is twelve hours from
      either clock and the result does not depend on when the suite runs
- [x] 4.3 Add an e2e case that moves the stale card out of Applied with the keyboard and verifies the
      flag is gone without a reload, and still gone after one. Use the shared helper in
      `e2e/keyboard-move.ts`, not bare key presses — its waits exist because of a measured flake
- [x] 4.4 Add an e2e case that picks the stale `e2e-applied` card up and drops it on Applied without
      choosing a column, and verifies it is still flagged and its stored `statusChangedAt` is
      unchanged. Use `pickUpAndDropInPlace` from `e2e/keyboard-move.ts`; `days-in-status.spec.ts`
      already does exactly this for the day count. This is the delta scenario "Dropped in its own
      column", which the first draft of this plan left with no task while `design.md` promised all
      four a test — and the hole it leaves is real: a later change making `planCardMove` return a
      move instead of `null` would reset the clock and silently unflag every stale card somebody
      picked up and put down
- [x] 4.5 Extend `e2e/long-value-layout.spec.ts` with a stale card carrying an **ordinary** company
      name, and verify no column changes width and the page does not scroll sideways. This is the
      flag measured alone, which is the delta scenario "A flagged card does not move the columns"
- [x] 4.6 Add a second row there: a stale card carrying a 200-character company name, measured
      separately. Two rows rather than one card carrying both, because a combined card could not say
      which of the two moved a column — the reason that file already records about its own control
      test, and which the first draft of this plan cited while doing the opposite
- [x] 4.7 Run `npm run test:e2e` and verify it passes. This needs
      `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION`, because `npm run e2e:db` issues
      `prisma db push --force-reset`; ask the user before running it

## 5. Record-keeping and the gates

- [x] 5.1 Add the `spec.md` change-log entry recording that the threshold is inclusive at 14 whole
      days and why, and that the flag is carried by text because colour alone fails WCAG 1.4.1.
      Verify the entry is dated and names this change
- [x] 5.2 Run `npm run verify` and verify it passes with no errors
- [x] 5.3 Run the `openspec-verify-change` skill (`/opsx:verify flag-stale-applications`) and fix
      anything it reports, so both mechanical gates have run before any review session is spent
- [ ] 5.4 **Offer** the user an independent `reviewer` pass and **wait for their answer**. This task
      is a reminder to ask, not authorization to launch. If they accept, launch it with
      `node .claude/hooks/review.mjs flag-stale-applications` — the launcher, never the Agent tool,
      because an in-process sub-agent inherits this session's permissions and the deny rules that
      enforce "never fix anything" would be absent. Pass the change name and nothing else: a list of
      things to check would turn an independent pass into this session's own checklist
