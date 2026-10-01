# Tasks

There is no red step for the new e2e test: the behaviour it measures is believed to already hold, so
it is a characterization test. It is proved non-vacuous by mutation instead — task 2.3 — which is the
convention this project already uses for that case.

## 1. Measure the control first

- [x] 1.1 Add `e2e/long-value-layout.spec.ts` that opens the board with only the seeded data and
      records each column's width, asserting the five are already equal to each other within 1px and
      that the document does not scroll horizontally. Verify it passes — a comparison against a
      broken control would prove nothing
- [x] 1.2 Verify the widths it records are not all zero or undefined, by asserting each is greater
      than 100px, so a selector that matched nothing cannot read as a pass

## 2. Measure the long value

- [x] 2.1 Extend the spec to insert one application whose company is a single unbroken
      200-character word, using `withDatabase` from `e2e/reset-board.ts` as
      `e2e/move-card.spec.ts` does, reload, and assert every column kept the width it had in 1.1,
      within 1px
- [x] 2.2 Assert in the same test that the document still does not scroll horizontally, and that the
      long value's own bounding box is within its column's — the three failure modes `design.md`
      lists
- [x] 2.3 Prove the test is not vacuous by mutation: remove `line-clamp-3` from the company in
      `ApplicationCard.tsx`, confirm the test fails and record the overflow it reports, then restore
      the class. Measured 807px at 1280 and 987px at 1100 (`scrollWidth` 2087 in both), not the 613px
      the archived note recorded — that note does not say at which viewport, so the numbers are not
      comparable and the new ones are what the test now holds. Only the overflow assertion failed;
      the column widths stayed equal, which is why `design.md` asks for three measurements
- [x] 2.4 Verify the test fails for the right reason by also confirming it still passes when
      `line-clamp-3` is changed to `line-clamp-1` — the depth is a design choice the spec leaves
      open, and a test that failed here would be pinning a promise the spec does not make
- [x] 2.5 Run `npm run test:e2e` and confirm both the `wide` and `wrapped` projects pass

## 3. Remove the proxy it replaces

- [x] 3.1 In `components/board/ApplicationCard.test.tsx`, remove the `break-words` and `line-clamp-`
      class assertions and rename the test to say what it now checks — that a very long value is
      present on the card — keeping the assertion that the value is rendered
- [x] 3.2 Verify the renamed test still fails if the value is not rendered, by mutation: have the
      card render `application.company.slice(0, 10)` and confirm it fails, then restore
- [x] 3.3 Run `npm run verify` and confirm lint, typecheck and the unit suite pass

## 4. Leave the database as it was found

- [x] 4.1 Verify `resetBoard` removes the inserted row, by running the whole suite twice in a row
      against one already-seeded database with no reseed between, and confirming both runs pass
- [x] 4.2 Verify the seeded rows are unchanged after a run, by comparing the ids, companies and
      statuses in `e2e.db` before and after

## 5. Close the finding

- [x] 5.1 Update `docs/reviews/decisions.md` to close `R20260927-6`, and correct the two
      misstatements in its entry: that the e2e suite measured page overflow — it did not, and
      `git log -S` over `e2e/` shows it never did — and that a change of clamp depth passing is a
      gap, when the spec sets no depth
- [x] 5.2 Verify the ledger's "Open — not yet decided" section is now empty, or says what remains,
      rather than leaving a closed finding listed as open
- [x] 5.3 Run `npm run verify` and `npm run test:e2e` and confirm both pass before marking the
      change complete
