# Design

## Context

See `proposal.md` — Why. What shapes the approach is where the board actually renders:

- `app/page.tsx` is a Server Component. `listApplications` calls `await connection()` before the
  query, which is what makes the page dynamic — it is rendered per request, not at build time.
- `Board.tsx` and `BoardColumn.tsx` carry `"use client"`. `ApplicationCard.tsx` has no directive,
  but it is imported by them, so it is in the client bundle and renders **twice**: once on the
  server for the HTML, once on the client during hydration. Anything it derives from `new Date()`
  would differ between the two.
- `useBoardCards` holds the visible list as `useOptimistic(applications, applyChange)` over
  `JobApplication[]`, with `BoardChange` being `{ kind: "move" }` or `{ kind: "remove" }`. The move
  change currently sets only `status`.
- `planStatusChange` (`lib/applications/status.ts`) writes `statusChangedAt: now` when the status
  really changes and returns `null` when it does not, so the stored clock is already correct. The
  badge is a reader, not a second writer.
- `BoardColumn` already solved "a number must be announced as what it counts": the badge there is a
  `<span aria-hidden>` holding the digit plus an `.sr-only` span holding `"3 applications"`, because
  a bare `<span>`'s `generic` role is name-prohibited in ARIA and an `aria-label` on it is not
  something a screen reader can be relied on to announce.
- `e2e/long-value-layout.spec.ts` measures that a 200-character company name does not change any
  column's width, in two viewports. The card header is the measured area.
- The e2e seed uses a fixed `SEEDED_AT` so a reseed leaves byte-identical rows. Those rows are
  therefore a fixed number of days before January 2026, and a now-relative count over them grows by
  one every real day.

## Goals / Non-Goals

**Goals:**

- One instant per request, one arithmetic rule, one place it lives.
- The badge correct on first paint, with no hydration mismatch and no post-mount flicker.
- A moved card reads as newly arrived immediately, and goes back if the move fails.
- The rule reusable as-is by MVP item 6, which thresholds the same number at 14.

**Non-Goals:**

- No ticking badge. It does not update while the board sits open; `spec.md`'s existing requirement
  already frames the board as the stored data at the moment it was served.
- No absolute date on the card, no "last changed on 3 March" tooltip. Not asked for, and the card
  header has no room to spare.
- Not MVP item 6. No stale styling, no 14-day threshold, no colour change.
- No relative-time library. The rule is one subtraction and a floor.

## Decisions

### Whole elapsed days, decided by the user

`floor((now − statusChangedAt) / 86_400_000)`, clamped at zero.

Alternatives were put to the user with the case that separates them — a status changed yesterday at
17:00, read this morning at 09:00. Calendar days call that "1 day" and match how people speak, but
need a timezone, and the server's is not the viewer's, so the number can be wrong by one for a
reason the person cannot see. A client-side calendar count is always right for the viewer but
mismatches the server HTML on first paint. The user chose elapsed days on the server.

The awkward consequence — that example reads as under a day — is answered by wording, not
arithmetic: zero is rendered as "Today". That keeps MVP item 6's rule exactly what `spec.md` already
writes, `statusChangedAt` older than 14 days, with no second notion of a day to reconcile.

### The instant is a prop, and the pure function is a module

`lib/applications/status-age.ts` exports two pure functions of their arguments:

```
daysInStatus(statusChangedAt: Date, now: Date): number   // whole days, never negative
describeDaysInStatus(days: number): { short: string; full: string }
```

No `new Date()` inside either, so both are testable without mocking a clock — which is what
`AGENTS.md` asks for logic that can be tested in isolation, and what lets item 6 call the first one
without inheriting a badge's wording.

`short` is what the badge shows (`"Today"`, `"1d"`, `"12d"`); `full` is what assistive technology
reads (`"Today in Interview"`, `"1 day in Interview"`, `"12 days in Interview"`). Two strings rather
than one because the card has room for an abbreviation and a screen reader needs the words — the
same split `BoardColumn` already makes, and the spec requires the announced form to be the full one.

`describeDaysInStatus` therefore takes the status label as well as the count. The label comes from
`BOARD_COLUMNS` in `lib/applications/board.ts`, which already owns the five human-readable names, so
the badge does not invent a sixth spelling. Naming the status rather than saying "in this status" is
the proposal review's open question answered: a card's accessible name is its company and its status
is carried only by the column landmark around it, so "in this status" is a phrase the listener
cannot resolve without leaving the card.

`page.tsx` takes the instant once (`const now = new Date()`) and passes it to `Board`, which threads
it through `BoardColumn` and `DraggableCard` to `ApplicationCard`. It crosses the server/client
boundary in the RSC payload, where a `Date` serialises.

**`now` is a required prop at every level, with no default.** `BoardColumn` and `DraggableCard`
default most of their optional props, and a `now = new Date()` default here would type-check, keep
every existing test green, and put a clock back inside a component that renders twice — which is the
single failure this whole decision exists to prevent. A required prop makes the omission a
compile error instead, and the existing component tests are updated to pass an explicit instant.

Alternative considered: computing the number in `page.tsx` and handing each card a view model
`{ ...application, daysInStatus }`. Rejected — the board moves `JobApplication[]` through the hook,
the optimistic reducer, `groupApplicationsByStatus` and every existing test; widening that shape
touches all of them, and it gives the optimistic move a second derived field to keep in step with
`status`. One `now` prop leaves the data shape alone.

Alternative considered: a `<time>` element with `suppressHydrationWarning` and a client-side
recompute. Rejected — it is the mismatch the user's choice exists to avoid, and the badge would
visibly change after hydration.

### The optimistic move sets `statusChangedAt`

`applyChange`'s `move` branch sets `statusChangedAt` to the instant the board was served alongside
`status`, so the moved card's count is zero while the write is outstanding.

This is not a guess about the server: `planStatusChange` provably resets `statusChangedAt` on a real
status change, so showing the old count in the new column would be the one thing the board knows to
be wrong. Using the served instant rather than a fresh `new Date()` keeps the client clock out of a
rendered number, and the difference between the two is at most the age of the page.

The badge is as of the served instant in both directions, and that is the whole rule. On a page left
open for hours, a just-moved card reads "Today" measured against an instant that is itself hours
old — the same instant every other badge on that page is measured against. The two only diverge once
the page is a day old, and a page that old is already showing yesterday's count on every card, so
the moved one is not the anomaly.

A failed move needs no special handling: the optimistic change is dropped when the transition
settles and the board falls back to the server list, which carries the original `statusChangedAt` —
the same mechanism that already puts the card back in its column. A card dropped on its own column
never reaches `moveCard`, because `planCardMove` returns `null` for it, so that clock is untouched by
construction.

The `remove` branch is unaffected: a deleted card has no badge to update.

### Where the badge sits on the card

Below the position line, on its own row, not in the header. The header is already three controls in
a `shrink-0` group beside a heading that is the only flexible item, and `line-clamp-3 break-words`
on that heading is what the layout test measures. Adding a fourth item to that row is the one change
most likely to move it.

The badge itself is `shrink-0` with `tabular-nums`, so a four-digit count does not reflow the row it
shares.

## Risks / Trade-offs

- **A reader may expect calendar days and read "Today" on a card that moved yesterday** → accepted
  and chosen by the user; the zero case is worded as "Today" rather than "0 days" so it reads as a
  statement about today and not as a count that failed.
- **`Date` crossing the RSC boundary** → it serialises, and the alternative (epoch milliseconds)
  would push the conversion into the card. If a serialisation problem does appear, the prop becomes
  a number and the pure function keeps its `Date` signature; nothing else moves.
- **A new row in the card could change the measured layout** → `e2e/long-value-layout.spec.ts` runs
  in both viewports and is the check. A card grows taller by one line, which the column absorbs;
  what must not change is any column's width.
- **A four- or five-digit badge is a second thing that could widen a column, and the existing
  measurement does not produce one** → the layout spec inserts a 200-character *company name* with
  `statusChangedAt` set to now, so the badge on that card reads "Today", the shortest value there
  is. A separate row is inserted — ordinary company name, `statusChangedAt` several thousand days
  back — and the columns re-measured. Separate rather than folded into the long-name row for the
  reason that spec already records about its own control test: one measurement with two possible
  causes cannot say which of them moved the column. Reasoning alone was considered and rejected:
  this project has already deleted jsdom assertions that argued about layout instead of measuring
  it (`docs/reviews/decisions.md`), and a `shrink-0` element with a min-content width is the same
  mechanism that broke the heading.
- **The e2e seed's fixed dates mean a hardcoded expected number would rot by one a day** → the
  end-to-end assertion computes its expectation from the row's stored `statusChangedAt`, which the
  specs already read through `withDatabase`. Changing the seed to now-relative dates was considered
  and rejected: byte-identical reseeds were a deliberate earlier decision, and `resetBoard` restores
  from a snapshot of those exact rows.
- **Two readers of `statusChangedAt` once item 6 lands** → why `daysInStatus` is a function of two
  instants and knows nothing about badges or thresholds. Item 6 compares its result; it does not
  re-derive it.
