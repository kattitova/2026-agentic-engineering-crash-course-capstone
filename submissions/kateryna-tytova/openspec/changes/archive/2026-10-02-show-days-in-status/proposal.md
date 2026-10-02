# Proposal

## Why

The board says which stage each application sits at but nothing about how long it has sat there, so
the one thing a job hunt actually needs — which applications have gone quiet — is invisible. A card
that moved to Interview this morning and one that has not moved in three weeks look identical.

`statusChangedAt` was added to the data model on 2026-09-13 for exactly this (see the `spec.md`
change log) and is already maintained correctly: `planStatusChange` writes it only when `status`
really changes, and returns `null` for a card dropped back in its own column, so the clock is not
reset by a misjudged drag. Nothing reads it yet. This change is MVP item 5, and it is the first
reader.

## What Changes

- Each card shows how long its application has been in its current status, counted in whole elapsed
  days from `statusChangedAt`.
- The count is computed **on the server**, once per request, from one instant. The board is a client
  tree (`Board`, `BoardColumn` and therefore `ApplicationCard` all render on the client as well as
  during SSR), so a card calling `new Date()` itself would produce a different number on the server
  than on the client and mismatch hydration. The server's instant is passed down instead.
- Whole elapsed days — `floor((now − statusChangedAt) / 24h)` — not calendar days. This is
  timezone-independent, so the number cannot be wrong by one for a viewer whose clock is not the
  server's, and it is what `spec.md` already literally says for MVP item 6 ("`statusChangedAt` older
  than 14 days"). The cost is that a status changed yesterday evening reads as under a day old this
  morning; that is handled by wording the zero case as "Today" rather than by changing the
  arithmetic.
- A move resets the badge to zero at the same time as it moves the card, because the write it stands
  for does reset `statusChangedAt`. A move that fails drops that along with the status, so the badge
  goes back with the card.
- The badge is announced as a length of time, not as a bare number — the same lesson the column count
  already learned.

**Not in this change:** MVP item 6, the "stale" flag for an application sitting in Applied for more
than 14 days. It reads the same field and will reuse the same day count, but it is its own visual
treatment and its own threshold, and bundling them would make one change that does two things. This
change deliberately leaves the day count as a pure function the stale flag can call.

## Capabilities

### New Capabilities

None. This is new content on an existing card.

### Modified Capabilities

- `kanban-board`: gains a requirement that each card shows how long its application has been in its
  current status, including what the count means, the zero and singular cases, a value that cannot
  be negative, how the badge behaves across a move and a failed move, how it is announced, and that
  it does not distort the card or its column.

## Impact

- `lib/applications/` — a new module holding the day count as a pure function of two instants, so
  the rule is testable without a DOM and without a clock to mock, and so MVP item 6 can call it.
- `components/board/ApplicationCard.tsx` — the badge, and the instant it counts against.
- `components/board/Board.tsx`, `BoardColumn.tsx`, `DraggableCard.tsx` — the instant threaded down
  to the card.
- `components/board/useBoardCards.ts` — the optimistic `move` change also sets `statusChangedAt`, so
  a moved card reads as zero days in its new status before the write settles.
- `app/page.tsx` — reads the instant once per request and hands it to the board.
- `e2e/` — the seeded rows carry fixed dates (`SEEDED_AT`, deliberately, so a run leaves
  byte-identical rows), which makes them useless for asserting an exact count: a literal number
  would be wrong by one more every day, and computing one from the stored value instead still
  disagrees by one on a run that straddles the 09:00:00Z the seeded instants sit on. The end-to-end
  assertions insert their own rows at a controlled age instead — one at 12 days and 12 hours, so the
  flooring is unambiguous whenever the run happens, and one several thousand days old for the
  layout measurement.
- `components/board/ApplicationCard.test.tsx`, `BoardColumn.test.tsx`, `Board.test.tsx` and
  `useBoardCards.test.ts` — each renders the component or hook that gains the instant, so each is
  updated to pass one. It is a required prop with no default, so a missed call site is a compile
  error rather than a test that quietly keeps its own clock.
- `spec.md` — a change-log entry recording the counting rule, why calendar days were not used, and
  that MVP item 6 will threshold the same function.
- No change to `prisma/schema.prisma`: `statusChangedAt` already exists. No new dependency.
