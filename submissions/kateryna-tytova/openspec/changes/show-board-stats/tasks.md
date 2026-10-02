# Tasks

`summariseBoard` is new business logic — two counts and a rounding rule with two clamps — so it is
written red-first: 1.1 writes **every** assertion about it, 1.2 makes them pass. Nothing else here is
new logic: the optimistic reducer already rewrites `status` and filters a deleted row, so both figures
follow a move and a deletion without new handling. Those tasks say what the tests must pin down.

1.1 carries the exact values on purpose, the clamps included. An earlier draft of this plan left them
to a task after 1.2, where they would have been first pinned by a test nobody ever saw red — the order
`AGENTS.md` → Tests rules out. Raised as `P20261002-2` by the 2026-10-02 proposal review.

No task below asserts layout in a component test. jsdom has no layout engine, so such a test can only
be an assertion on a class substring, which `R20260927-6` deleted from this project; the layout
guarantees are measured in Playwright, in group 4. See `design.md` → "Layout is measured in a browser,
never in jsdom".

Group 2 must not start before 1.2 is green: the region renders what the function returns, including
the `null` the empty case depends on.

## 1. The figures, as pure functions

- [x] 1.1 Write failing tests (red) for `summariseBoard(grouped)` in a new
      `lib/applications/stats.test.ts`, building `grouped` with `groupApplicationsByStatus` so the
      tests exercise the same filter the board does. Cover, asserting **exact** values throughout:
      15 applications with 2 in Interview and 1 in Offer → `total 15`, `reachedInterview 3`,
      `percentReachedInterview 20`; 10 with 5 Wishlist, 4 Applied, 1 Interview → `10`; a board whose
      only application is in Offer → `total 1`, `reachedInterview 1`, `100`; a Rejected application not
      counted; 8 with none in Interview or Offer → `0`; 4 all in Interview or Offer → `100`; an empty
      board → `total 0`, `reachedInterview 0`, `percentReachedInterview` **`null`**; 3 with 1 in
      Interview → `33`; **201 with 1 in Interview → exactly `1`**; **201 with 200 in Interview or Offer
      → exactly `99`**; and 4 rows of which one has a status outside the five, one in Interview →
      `total 3` with the share measured against 3. Verify every test fails before the module exists.
      The two clamp cases assert `1` and `99` rather than "not 0" and "not 100" because an
      implementation returning `0.5` and `99.5` would satisfy the weaker form while breaking the
      whole-number requirement. The one-application case is the delta scenario "The first application",
      which no task reached in the first draft (`P20261002-3`)
- [x] 1.2 Add `lib/applications/stats.ts` with `BoardSummary` and
      `summariseBoard(grouped: ApplicationsByStatus): BoardSummary`, typing
      `percentReachedInterview` as `number | null`, and verify 1.1 passes. `null` rather than `0` for
      the empty board is the point: the call site then cannot render a percentage without handling the
      case, which `0` would have let it do silently
- [x] 1.3 Verify by signature, and by `npm run typecheck`, that the parameter is
      `ApplicationsByStatus` and that nothing inside `summariseBoard` filters on status. The guarantee
      that the unknown-status exclusion happens once, in `groupApplicationsByStatus`, is carried by the
      **type** and not by any test — a second filter inside the function would satisfy 1.1's
      unknown-status case identically. Stated as its own task so the next reader does not add that
      filter "for safety" and quietly give the rule two owners (`P20261002-2`)

## 2. The region on the page

- [x] 2.1 Add `components/board/BoardStats.tsx` taking one `summary: BoardSummary` prop and no `now`:
      a landmark (`<section>` with `aria-label`) holding the total written out with the word
      "applications" — singular for 1 — and, when `percentReachedInterview` is not `null`, the
      percentage with what it counts. Verify a test asserts the **visible** text of both figures;
      there is no `aria-hidden`/`.sr-only` pair here, because the words are shown, and a test that
      only queried the accessible name would pass against an empty region
- [x] 2.2 Include, always visible, a short line naming the counted set — applications now in
      Interview or Offer. Verify a test asserts that text is present on a board that has reached
      applications and on one that has none. This is the delta scenario "What the percentage counts is
      readable", and it is the only thing on screen that tells a person with rejections on the board
      that those are not counted
- [x] 2.3 Verify with tests that `percentReachedInterview: null` renders **no** percentage and no
      "0%" anywhere in the region, and that the region is still rendered with its total of zero and the
      exact wording `design.md` fixes — "No applications yet" — rather than a missing value. Assert the
      absence of the string "0%", not just the absence of a specific element: the delta forbids the
      output, however it is produced
- [x] 2.4 Verify with a test that the singular and plural forms are both right: 1 application reads
      as one application, 0 and 2 read as plural. One template literal per figure, not
      `{count} {word}` in JSX, for the reason `BoardColumn` already records about its count
- [x] 2.5 Verify with a test that both figures are shown **written out** — the number with the word
      "applications", the percentage with what it counts — and that no figure appears only in a
      shortened form. This is the delta scenario "The figures are written out", which replaced an
      untestable scenario about abbreviations; it is the assertion that keeps the "visible text is the
      accessible text" decision true, since that decision only holds while nothing here is abbreviated
- [x] 2.6 If the region is given a tinted background, compute the text/background contrast ratio
      against that tint **before** writing the classes and record the figure in a comment. Verify it
      is at least 4.5:1 for text under 18px with margin for Tailwind 4's oklch values, as `spec.md`'s
      2026-10-02 entry requires. If the region stays on the page background, say so in a comment so
      the next reader knows the check was considered rather than skipped

## 3. Wiring it into the board

- [x] 3.1 Render `BoardStats` from `Board.tsx`, above the existing failure `role="alert"` paragraph
      and the column grid, passing `summariseBoard(grouped)` — the `grouped` the component already
      derives from `shown`. Verify a board-level test asserts the region appears before the columns in
      the DOM, which is the delta scenario "Position on the page"
- [x] 3.2 Verify with a board-level test, actions mocked, that moving a card from Applied into
      Interview raises the percentage **before the write settles**. This is the test that pins the
      computation to the optimistic list: compute it in `app/page.tsx` from the server list instead and
      this fails. Use a deferred promise for the action so the assertion lands while the write is
      outstanding

      **Revised during apply, with the user's agreement.** A *move* cannot be driven at board level:
      dnd-kit needs real layout, which jsdom does not have, and `Board.test.tsx` already records that
      — every board-level move test there substitutes a `rerender` with the server list. So the
      guarantee is pinned from the two sides that can actually reach it, and the deferred-promise half
      is kept, on the write jsdom *can* drive:

      - **board level, before the write settles, through a deletion** — `deferDeletion`, delete an
        Applied card from a board of three, and assert the summary already reads 2 applications and 50%
        while the write is outstanding. The server list still holds three at that moment, so a summary
        computed in `app/page.tsx` reads 3 applications and 33% and the test fails. This is the
        assertion that pins the computation to the optimistic list
      - **e2e, through a real keyboard move with no reload** — move the Applied card into Interview in
        a browser and assert 67% before any reload. Stronger than the original task asked for, because
        the move is real rather than stood in for

      Do **not** add a jsdom move test by faking `getBoundingClientRect` to make dnd-kit run: it would
      assert the fake as much as the board
- [x] 3.3 Verify with a board-level test that a move from Interview into Rejected lowers the share,
      and that a move from Wishlist into Applied changes **neither** figure. The second is the delta
      scenario "A move that changes neither figure"; it is asserted on purpose, so a later reader does
      not take a motionless summary for a bug
- [x] 3.4 Verify with board-level tests that deleting a card lowers the total by one and re-measures
      the share without a reload, and that deleting the only application leaves a total of zero and no
      percentage. The `remove` branch of `applyChange` already filters the row, so this is an
      assertion rather than new code
- [x] 3.5 Verify with board-level tests that a failed move and a failed deletion leave both figures as
      they were. Nothing restores them explicitly — `useOptimistic` drops the change and the server
      list wins — so these tests exist to pin that the figures ride on `shown` and nowhere else

      **Revised during apply, same reason as 3.2.** Only the failed *deletion* half is board-level
      (`Board.test.tsx`, "leaves both figures as they were when a deletion fails"). The failed *move*
      half is a hook test — `useBoardCards.test.ts`, "puts the figures back when the move fails" —
      because a move cannot be driven in jsdom. It asserts
      `summariseBoard(groupApplicationsByStatus(shown))`, which is the exact value `Board` renders, so
      the coverage is equivalent and only the level differs. Noted here because the first draft left
      this task reading as though a board-level failed-move test existed; the 2026-10-02 review raised
      the drift as `R20261002-7`
- [x] 3.6 Verify with a board-level test that the total equals the number of cards rendered, including
      on a board holding one row with a status outside the five. This is the cross-check the delta
      requires and the one assertion that spans the grouping, the summary and the columns

## 4. Layout and end to end

- [x] 4.1 Extend `e2e/long-value-layout.spec.ts` to measure the column widths with the summary present
      and verify no column changes width and the page does not scroll sideways, at both the
      single-row and the wrapped viewport that file already uses. This is the summary measured at its
      ordinary size — the seeded board's total of 3 — and it is the control for 4.2
- [x] 4.2 Add a second case there for a **four-digit total**: insert enough rows to reach 1000 in one
      `db.transaction` with better-sqlite3, following `insertLargeBadgeApplication` in that same file,
      reload, assert the summary reads 1000 applications, measure the column widths and horizontal
      scroll in both viewports, then call `resetBoard()`. Its own case rather than folded into 4.1, for
      the reason that file already records about its control test: one measurement with two possible
      causes cannot say which of them moved a column.

      This replaces a component-level test the first draft of this plan assigned here, which could not
      have failed: Vitest runs `environment: "node"` with jsdom per file, jsdom has no layout engine,
      and the only way to write such a test is an assertion on a class substring — which
      `R20260927-6` deleted from this project as a test that "could not fail for any reason the spec
      cares about". The 2026-10-02 proposal review raised it as `P20261002-1` and also showed the
      tooling claim behind it to be wrong: e2e seeds rows directly, so a thousand of them is one
      transaction. Do **not** add a jsdom layout assertion anywhere as well — a second, weaker check of
      the same requirement is what stops anyone from trusting this one
- [x] 4.3 Add `e2e/board-stats.spec.ts` asserting, against the seeded board — 3 applications, one of
      them in Interview — that the summary reads 3 applications and 33%, then move the Applied card
      into Interview and assert the percentage becomes 67% without a reload, and that it still reads
      67% after a reload. The reload half is what proves the figure follows stored data and not only
      the optimistic list. Call `resetBoard()` afterwards, as `e2e/edit-and-delete.spec.ts` does: the
      suite runs `workers: 1` against one shared database, so a moved card left behind would show a
      later spec two cards in Interview (`P20261002-5`)
- [x] 4.4 Run `npm run test:e2e` and verify it passes. This needs
      `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION`, because `npm run e2e:db` issues
      `prisma db push --force-reset`; ask the user before running it

## 5. Record-keeping and the gates

- [x] 5.1 Add the `spec.md` change-log entry recording the two definitional choices and why: that
      "reached interview" counts a current status of Interview or Offer because the data model holds
      no transition log and a Rejected application cannot be known to have been interviewed, and that
      the share is measured against every tracked application so the two figures in one line describe
      one set. Name the rounding clamps too. Verify the entry is dated and names this change. No "Data
      model" edit: nothing in `prisma/schema.prisma` changes, so no `npx prisma db push`
- [x] 5.2 Run `npm run verify` and verify it passes with no errors
- [x] 5.3 Run the `openspec-verify-change` skill (`/opsx:verify show-board-stats`) and fix anything it
      reports, so both mechanical gates have run before any review session is spent
- [x] 5.4 **Offer** the user an independent `reviewer` pass and **wait for their answer**. This task is
      a reminder to ask, not authorization to launch. If they accept, launch it with
      `node .claude/hooks/review.mjs show-board-stats` — the launcher, never the Agent tool, because an
      in-process sub-agent inherits this session's permissions and the deny rules that enforce "never
      fix anything" would be absent. Pass the change name and nothing else: a list of things to check
      would turn an independent pass into this session's own checklist
