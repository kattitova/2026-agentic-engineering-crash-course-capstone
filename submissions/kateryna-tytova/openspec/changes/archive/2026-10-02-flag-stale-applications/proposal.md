# Proposal

## Why

The board now says how long each application has sat where it is, but the person still has to read
every number to find the ones that have gone quiet. On a board of thirty applications that is thirty
small arithmetic problems, and the whole point of the day count was to make the stalled ones
findable at a glance.

MVP item 6 names the case worth flagging: an application in Applied that has not moved in more than
14 days. That is the one stage where silence is information — the application went out and nothing
came back. A card in Wishlist sitting for months is not stalled, it is a bookmark; a card in
Rejected is finished.

Everything this needs already exists. `daysInStatus` is a pure function of two instants, written in
the previous change so that this one could threshold it rather than re-derive it, and the served
instant is already threaded to the card as a required prop.

## What Changes

- A card whose application is in Applied and has been there 14 whole days or more gains a second
  badge beside the day count, reading "No movement".
- The flag is **not colour alone**. The badge carries visible text, because colour as the only
  carrier of meaning fails WCAG 1.4.1 — and because the same information has to reach someone
  reading the board with a screen reader. The amber tint reinforces the word; it does not replace
  it.
- The day count badge is left neutral. It answers "how long", the new badge answers "is this a
  problem", and merging them into one amber "280d · Stale" would make a single element carry two
  different questions.
- The rule reads both fields the spec names: `status === APPLIED` **and** 14 or more whole days. An
  old card in another column is not flagged, which is the half of the rule most easily lost — the
  seeded e2e board has a 263-day Wishlist card precisely so that case is exercised rather than
  assumed.
- The threshold is expressed against the same day count the badge shows, so a card reading "14d" is
  flagged and a card reading "13d" is not. Nothing computes elapsed time a second way.

**Not in this change:** no filtering or sorting by staleness, no count of stale applications in the
header (MVP item 7 is the stats row and is its own change), no reminder or notification — `spec.md`
puts those out of scope for the MVP.

## Capabilities

### New Capabilities

None. This is a second badge on an existing card, driven by a field the board already reads.

### Modified Capabilities

- `kanban-board`: gains a requirement that a card in Applied which has not moved in 14 whole days or
  more is flagged; that the flag is carried by visible text and not by colour alone; that the rule
  needs both the status and the age, so neither half alone flags a card; that the flag follows a
  move and a failed move the way the day count already does; and that it does not distort the card
  or its column.

## Impact

- `lib/applications/status-age.ts` — a predicate for the rule, beside `daysInStatus` it calls, so
  the threshold is testable without a DOM and lives next to the count it thresholds.
- `components/board/ApplicationCard.tsx` — the second badge in the row the day count already
  occupies, plus `flex-wrap` on that row: it is `flex` with no wrap today, so two non-shrinking pills
  would overflow rather than drop to a second line.
- `components/board/ApplicationCard.test.tsx`, `BoardColumn.test.tsx`, `Board.test.tsx` — the cases
  that distinguish a flagged card from an old card in the wrong column.
- `lib/applications/status-age.test.ts` — the threshold's boundary at 13 and 14 days, which is
  where the edge is, plus a well-past case and each of the four statuses the rule excludes.
- `e2e/` — the seeded board already holds one stale card (Applied, well past the threshold) and one
  old card in Wishlist, so the flag and its absence are both assertable without new seed data. The
  boundary itself is exercised with rows the spec inserts at a controlled age, as
  `days-in-status.spec.ts` already does.
- `e2e/days-in-status.spec.ts` — its "every card carries exactly one badge" case counts elements
  whose text ends in " in <Status>", so the flag's announced sentence must not end that way or the
  stale card is counted twice and that test fails for a reason unrelated to what it guards. The
  sentence is fixed in `design.md` for exactly this reason; named here so the constraint is not
  discovered by a failing run.
- `e2e/long-value-layout.spec.ts` — two new inserted rows: a stale card with an ordinary name, which
  measures the flag alone, and a stale card with a 200-character name. Separate rows, because one
  card carrying both could not say which of the two moved a column.
- `spec.md` — a change-log entry recording the threshold's inclusive edge and the reason the flag is
  not colour alone.
- No change to `prisma/schema.prisma`. No new dependency.
