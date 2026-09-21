# Design

## Context

See proposal.md — Why. The data layer exists and is tested; the UI does not exist at all.
`app/page.tsx` is still the create-next-app template.

Constraints that shape the approach:

- `listApplications()` in `app/actions/applications.ts` already returns every application
  ordered by `createdAt desc`. The board needs no new query.
- `app/globals.css` currently sets `body { font-family: Arial }` and flips `--background` to
  `#0a0a0a` under `prefers-color-scheme: dark`. The approved mockup is light-only.
- `app/layout.tsx` still carries the template metadata ("Create Next App").
- Project rules: Tailwind classes only, no per-component CSS file; logic that can be tested in
  isolation lives in `.ts` files outside components; a new UI interaction needs a test.

This change also sets the UI conventions every later board feature will follow, which is why it
gets a design document despite being small.

## Goals / Non-Goals

**Goals:**

- Establish where board UI code lives and how data reaches it.
- Define column identity (order, label, colour) in one place that later features reuse.
- Leave a seam where drag-and-drop can be added without reshaping the data flow.

**Non-Goals:**

- No client-side state. This change ships zero `"use client"` components.
- No date arithmetic. The day badge and stale flag are a later change, so nothing here depends
  on the current time.
- No dark theme. The mockup commits to one light look; dark mode is not an MVP item.

## Decisions

### The board page stays a Server Component

`app/page.tsx` awaits `listApplications()` and renders the columns directly. No fetch on the
client, no loading state, no hydration of board data.

Alternative considered: a client component fetching through the action. Rejected — it adds a
loading state and ships the whole list twice (RSC payload plus client fetch) for no gain while
the board is read-only.

Consequence for the next change: only the piece that needs pointer events becomes a client
component. The page keeps loading the data.

### Presentational components live in `components/board/`

A `components/` directory at the repository root, sibling to `app/` and `lib/`.

Alternatives considered: `app/board/` (colocation — a folder in `app/` is not a route until it
holds `page.tsx`, but the name reads like a route) and `app/_board/` (private folder, never
routable). Both work. `components/` was chosen because it is symmetrical with the existing
root-level `lib/` and carries no routing connotation at all.

### Column definition is a single exhaustive table in `lib/`

`lib/applications/board.ts` exports an ordered list of columns, each with its status, label and
colour token, typed so that the compiler rejects a missing status if `ApplicationStatus` ever
gains a value. Column order is funnel order, not the enum's declaration order, and is stated
once here.

Alternative considered: deriving columns from `Object.values(ApplicationStatus)`. Rejected —
that ties display order to schema declaration order and leaves labels and colours homeless.

### Grouping is a pure function, tested first

`groupApplicationsByStatus(applications)` returns a record keyed by status, with an empty array
for statuses that have none, so the rendering code never branches on "missing key". Per the
project's TDD rule, its test is written red before the implementation.

This keeps the only real logic in this change out of JSX, where it would need a rendering test
to exercise.

### Colours come from the Tailwind palette, not the mockup's hex codes

The mockup's values map onto stock Tailwind colours closely enough to use them directly:
slate for the Wishlist dot and neutrals, sky for Applied, violet for Interview, emerald for
Offer, rose for Rejected, indigo for the primary button, `slate-50` for the page ground.

Alternative considered: adding the exact hex values as custom theme tokens in `globals.css`.
Rejected for now — it adds a token layer for differences no one will see. If the design later
needs exact brand colours, that is a small, contained change.

### `globals.css` loses the dark-mode block and the Arial rule

The dark-mode override would put a near-black page ground behind a light board. The `body`
font rule hardcodes Arial while the layout already loads Geist as `--font-sans`.

Alternative considered: keeping the block and designing a dark variant. Rejected — dark mode is
not in the MVP, and shipping a half-supported theme is worse than one deliberate light theme.

### The "Add application" button renders disabled

The mockup's header has a primary button. Its form is a later change. Rendering a real
`<button disabled>` keeps the header faithful without a link that goes nowhere, and makes the
next change a one-line swap rather than a redesign.

## Risks / Trade-offs

- **A future status value silently misses a column** → the column table is typed as an
  exhaustive record over `ApplicationStatus`, so adding a status breaks the build until the
  column is defined.
- **Board markup grows into a place where logic hides** → grouping and column identity both sit
  in `lib/`, so the components stay a projection of props onto markup.
- **No e2e coverage in this change** → accepted. The Definition of Done e2e test is about
  dragging a card, which cannot be written before drag-and-drop exists. Unit tests cover the
  grouping, and the board's remaining behaviour is static rendering.
- **Removing the dark-mode block changes the look for anyone on a dark OS** → intended. The
  page becomes light for everyone instead of half-dark.
- **Cards will get denser later (badges, drag handles, menus)** → the card component takes one
  application and owns its own layout, so later features add elements inside one component
  rather than reshaping the columns.

## Open Questions

None that block implementation.
