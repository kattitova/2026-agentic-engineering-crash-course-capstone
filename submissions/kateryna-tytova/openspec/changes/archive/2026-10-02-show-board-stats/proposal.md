# Proposal

## Why

MVP item 7 in `spec.md` — "Simple stats above the board: total applications, % that reached
interview stage" — is the last item of the MVP scope with nothing behind it. The board already
answers "where is each application", column by column, but the question the tracker exists to
answer — "is this job search working" — currently has to be answered by counting five column
badges and dividing in your head. One line above the board answers it.

The timing is the point: items 5 and 6 landed the two pure functions that read `statusChangedAt`
and the convention that a derived number is computed from arguments, not from a clock inside a
component. Item 7 is the same shape — a number derived from the list the board is already holding —
so it is cheap now and gets more expensive once the board grows a second client-side list.

## What Changes

- A new summary region above the board shows two figures: how many applications are tracked, and
  what share of them reached the interview stage.
- **"Reached the interview stage" means an application whose current status is Interview or Offer.**
  The data model stores only the current status, with no history of transitions, so a Rejected
  application cannot be known to have been interviewed before the rejection. That limit is stated
  in `design.md` and carried into the region's own wording rather than left implicit — a figure
  that quietly undercounts is worse than one that says what it counts.
- **The share is measured against every tracked application, including Wishlist.** The two figures
  therefore describe one set, so "3 of 15" can be checked against the total standing beside it.
- An empty board shows the total as zero and shows no percentage at all. 0% of nothing is a claim
  about a job search that has not started.
- The figures follow an optimistic card move or deletion without the page being reloaded, exactly
  as the day badge and the stale flag already do. A board that shows a card arriving in Interview
  while the percentage above it still reads the old value would be contradicting itself on screen.
- The percentage is rounded to whole numbers, and never rounded to 0% while some application has
  reached interview, nor to 100% while some application has not.
- Applications whose stored status is not one of the five known statuses are left out of both
  figures, so the total matches the number of cards actually on the board.

Explicitly **not** in this change: per-column percentages, a chart, an offer rate, a trend over
time, or anything derived from `appliedDate`. `spec.md` asks for two figures and the scope rule in
`AGENTS.md` makes adding a third a spec change first.

## Capabilities

### New Capabilities

- `board-stats`: a summary of the whole set of tracked applications, shown above the board — how
  many there are, and what share of them reached the interview stage — including what "reached"
  means given a data model with no status history, how an empty board reads, how the figures stay
  in step with an unsaved card move, and how they are announced to assistive technology.

### Modified Capabilities

_None._ `kanban-board` keeps every requirement it has: the columns, their counts, the cards and
their badges are untouched. The summary sits above the board and reads the same list; it adds no
requirement to the board and removes none.

## Impact

- **New** `lib/applications/stats.ts` and `lib/applications/stats.test.ts` — pure functions over the
  grouped board: the two counts and the percentage, with the rounding rule. Tested in isolation, as
  `AGENTS.md` requires for business logic, with the tests written red first.
- **New** `components/board/BoardStats.tsx` and `BoardStats.test.tsx` — the region itself,
  Tailwind-only, no state of its own.
- **Modified** `components/board/Board.test.tsx` — the board-level assertions that the figures ride on
  the optimistic list: a deletion re-measures them before its write settles, and a failed deletion puts
  them back.
- **Modified** `components/board/useBoardCards.test.ts` — the same assertions for a *move*, which
  cannot be driven at board level because dnd-kit needs real layout. They summarise the hook's `shown`,
  which is the list `Board` summarises.
- **Modified** `e2e/long-value-layout.spec.ts` — the summary measured at its ordinary size, and again
  at a seeded four-digit total. The layout guarantees are asserted only in a browser; see `design.md` →
  "Layout is measured in a browser, never in jsdom".
- **New** `e2e/board-stats.spec.ts` — the figures against the seeded board, across a move and a reload.
- **Modified** `components/board/Board.tsx` — renders `BoardStats` above its column grid, from
  `shown`. `shown` is the optimistic list from `useBoardCards`, which is the only list on the page
  that already reflects an unsaved move; computing the figures anywhere else (for example in
  `app/page.tsx`, from the server list) would leave them a revalidation behind the cards.
- **Unchanged**: `prisma/schema.prisma` — no data-model change, so no `npx prisma db push` and no
  "Data model" entry in `spec.md`. No server action, no new query, no new dependency. `app/page.tsx`
  keeps its current shape; the `now` instant it already passes is not needed by either figure,
  because neither depends on elapsed time.
- `spec.md` gets a "Spec change log" entry recording the two definitional choices above — what
  "reached interview" counts and what it is measured against — because neither is recoverable from
  the code and the next reader of item 7 lands on the same fork.
- No overlap with the in-flight `tighten-link-validation` change: that one touches
  `lib/applications/validation.ts`, `ApplicationCard.tsx`, the form and their tests, and declares deltas
  on `application-form` and `kanban-board`. This change touches none of those files and declares a delta
  on neither capability. The one file both changes name is `e2e/long-value-layout.spec.ts`, and only this
  one edits it — `tighten-link-validation` cites it as context and leaves it alone. So the two can
  proceed in parallel.
