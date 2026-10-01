# Design

## Context

See proposal.md — Why.

What already exists and shapes the approach:

- `Board` lays the columns out as `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5`.
  Grid tracks are equal fractions, so column widths are equal *by construction* — unless a column's
  min-content width exceeds its track, which is exactly what an unbroken 200-character word does.
- `ApplicationCard` puts `line-clamp-3 break-words` on the company and `line-clamp-2 break-words` on
  the position. Its comment records why the clamp is load-bearing rather than cosmetic: it implies
  `overflow: hidden`, which lets the flex item shrink below its content width. The same comment
  records a measurement — 613px of horizontal overflow without the clamp, 0 with it.
- `e2e/reset-board.ts` exports `resetBoard` and `withDatabase`. `resetBoard` restores the seeded
  statuses and deletes every row that is not seeded, so a row a test inserts is cleaned up by the
  `beforeEach` of whichever spec runs next.
- `e2e/move-card.spec.ts` already inserts a row straight into `e2e.db` with `withDatabase`, so the
  pattern for getting unusual data onto the board exists.
- `playwright.config.ts` runs two projects: `wide` at 1280 (the `xl` breakpoint, five columns on one
  row) and `wrapped` at 1100 (`lg`, three columns then two).
- Columns are `role="region"` named by their heading, which is how the existing specs address them.

## Goals / Non-Goals

**Goals:**

- Measure the sentence the spec actually contains: a long value does not change a column's width or
  the board's layout.
- Make the measurement fail if the clamp is removed, which is the change that demonstrably breaks the
  layout.
- Stop presenting a class-name assertion as evidence of geometry.

**Non-Goals:**

- Pinning how many lines a value is shortened to. The spec says "wrap or be shortened" and leaves the
  depth open, so a height assertion would be testing a decision rather than a promise.
- Changing any rendering. If the measurement fails on first run, that is a defect to report.
- Visual regression tooling. A screenshot comparison would catch this and a hundred unrelated
  things, and would need a baseline per project and per platform.

## Decisions

### The assertion is a comparison against a control, not an absolute number

The test measures the five column widths with the seeded data, then inserts the long-value
application, reloads, and measures again. The widths must be unchanged.

This is the requirement's own wording — "SHALL NOT **change** the width of its column" — turned into
an assertion. An absolute number would need updating whenever the layout, the gap or the viewport
changed, and it would say nothing about whether the long value was what moved it.

### The control is also asserted, so a both-broken board cannot pass

A comparison passes if the before and after are equally wrong. So the control is checked too: before
the long value exists, the document must not scroll horizontally and the five widths must already be
equal to each other. Only then does "unchanged" mean anything.

### Three measurements, because the requirement has more than one failure mode

| Measured | The failure it catches |
| --- | --- |
| Each column's width, before vs after | A column stretched to fit one card |
| `scrollWidth` vs `clientWidth` on the document | The row overflowing instead, which is what removing the clamp actually does |
| The long text's box within its column's box | The text escaping its card without moving the grid |

The second is the one the archived manual check saw as 613px. The third is a belt-and-braces
assertion against a value that paints outside its column while the grid holds.

### Tolerance of one pixel, stated rather than discovered

Widths come back as fractional CSS pixels, and a grid dividing a container by five rarely lands on
integers. The comparison allows 1px, which is far below the ~600px a real break produces, and the
reason is written next to the number so a later reader does not tighten it and get a flake.

### Both projects, because a wrapped grid is where it would break first

At 1100px the grid is three columns, so each track is wider and the second row holds two. A
min-content overflow in a wrapped grid can push one row without touching the other, which a
five-across measurement would not see. The existing `wrapped` project costs nothing to reuse.

### The class assertions are removed, not kept alongside

`toContain("break-words")` and `toContain("line-clamp-")` cannot fail for any reason the spec cares
about, and once geometry is measured they are strictly weaker than the test beside them. Keeping both
would leave a reader two assertions, one of which is evidence and one of which looks like it.

What stays in the jsdom test is the clause the spec does make and jsdom can check — that the card
contains the long value at all. The test is renamed accordingly: it is about the value surviving, not
about clamping.

### The long value is inserted into the database, not typed into the form

The form caps `company` at 120 characters through `APPLICATION_LIMITS`, and the point of this test is
a value longer than anything the interface will accept. A direct insert is also how
`e2e/move-card.spec.ts` gets data the interface cannot produce, so the pattern is established.

200 characters, unbroken, matching the archived manual check and the spec scenario's "a single very
long unbroken word".

## Risks / Trade-offs

- **The measurement may fail on the first run** → that would mean the layout guarantee is broken
  today and the archived manual check no longer holds. Reported as a defect rather than worked
  around; the tasks say so explicitly rather than assuming green.
- **It cannot catch a change in clamp depth** → accepted, and the point. `line-clamp-3` to
  `line-clamp-1` is a visual decision the spec leaves open. Removing the clamp entirely is a layout
  break, and that the test does catch.
- **One more row inserted into the shared e2e database** → `resetBoard` already deletes every
  non-seeded row, so the cleanup is the existing one. The suite's "runs twice from an already-seeded
  database" property is re-checked rather than assumed.
- **Font metrics differ across platforms** → the assertions are about grid geometry and document
  overflow, not text size, so a different font changes how many characters fit on a line and not
  whether a column kept its width.

## Open Questions

None. The one that would have changed the shape of this work — whether to pin the clamp depth, which
would have meant adding a requirement — was settled before the change was written: the spec leaves
the depth open, so the test measures layout and not line count.
