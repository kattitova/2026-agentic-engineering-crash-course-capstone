# Proposal

## Why

The data layer for the job tracker is finished — schema, server actions and seed data all
work — but `app/page.tsx` is still the unmodified create-next-app template. Nothing in the
product is visible yet: the only way to see an application today is to open the SQLite file.
Rendering the board is the smallest step that turns the existing data layer into something
usable, and every later feature (drag-and-drop, stats, forms) needs the board to exist first.

## What Changes

- `app/page.tsx` becomes the board page: a Server Component that loads applications through
  the existing `listApplications()` server action and renders them.
- A new `components/` directory at the repository root (sibling of `app/` and `lib/`) holds
  the board's presentational components.
- The board renders exactly five columns, one per `ApplicationStatus`, in funnel order:
  Wishlist, Applied, Interview, Offer, Rejected. Columns are fixed: they are derived from the
  status enum, not from the data, so an empty status still shows its column.
- Each column shows its label, a status colour dot, and a count of the cards in it.
- Each card shows company, position, and links to the job posting when `link` is set.
- An empty column shows a short empty state instead of a blank area.
- Column order, labels and colours come from one shared definition in `lib/`, so later
  features (drag-and-drop, stats) use the same source.
- Grouping applications by status becomes a pure, unit-tested function in `lib/`.
- Visual design follows the approved mockup: https://claude.ai/artifact/PFrhmsLaTwCYJWFnQcdNMm

Not in this change, deliberately — each is its own later change:

- Drag-and-drop between columns (the columns here are static).
- The "N days in this status" badge and the stale flag.
- The stats row above the board (total, reached-interview, stale).
- The add / edit / delete forms. The mockup's "Add application" button is rendered as a
  disabled control so the header matches the design without implying working behaviour.
- The `interviewedAt` field. It was accepted during exploration so that the reached-interview
  metric does not lose applications rejected after an interview, but it only pays off once the
  stats row exists, and it is a schema change. It belongs to the stats change.

## Capabilities

### New Capabilities

- `kanban-board`: displaying job applications as a Kanban board — which columns exist, in what
  order, how applications map onto them, what a card shows, and what an empty column shows.

### Modified Capabilities

<!-- None: this is the project's first capability spec. -->

## Impact

- **Code**: `app/page.tsx` (replaced), new `components/board/*`, new `lib/applications/board.ts`
  plus its test. No changes to `app/actions/applications.ts` — `listApplications()` already
  returns what the board needs.
- **Data**: none. No schema change, no migration, no `prisma db push`.
- **Dependencies**: none added. `@dnd-kit` stays unused until the drag-and-drop change.
- **Docs**: `spec.md` MVP item 1 becomes implemented; items 2-7 stay open.
- **Tests**: new unit tests for the grouping function. No e2e test yet — the Definition of Done
  e2e test covers dragging a card, which arrives with the drag-and-drop change.
