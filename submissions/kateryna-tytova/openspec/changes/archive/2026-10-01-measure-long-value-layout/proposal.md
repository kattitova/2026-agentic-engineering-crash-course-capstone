# Proposal

## Why

The `kanban-board` spec promises that a long value "SHALL NOT change the width of its column or the
layout of the board". Nothing checks it.

What exists is one jsdom assertion in `components/board/ApplicationCard.test.tsx` that the company
and position carry `break-words` and a `line-clamp-` class. It is a proxy for geometry, and its own
comment says so: jsdom has no layout. Beyond that, a single manual look in `npm run dev` on
2026-09-27, recorded in an archived task.

This is finding `R20260927-6`, open in `docs/reviews/decisions.md` since 2026-09-27. Two things about
that entry are worth correcting, because they change what the work is:

- It says the e2e suite "measures page overflow, not the clamp depth". It does not. There is no
  `scrollWidth`, `clientWidth`, `boundingBox` or `overflow` anywhere in `e2e/`, and
  `git log -S` over that directory shows there never was. The layout guarantee has **no** automated
  coverage, which is a larger gap than a weak assertion.
- Its example — `line-clamp-3` changed to `line-clamp-1` still passes — breaks the test but does not
  break the spec. The requirement says "wrap or be shortened", with no depth. The clamp depth is a
  design choice, so a test that pinned it would be inventing a promise the spec does not make.

So the gap to close is the measurable half of the requirement, in the one place where layout exists.

## What Changes

**A Playwright test measures what the requirement guarantees.** With one application whose company
is a 200-character unbroken word:

- every column keeps the width it had before that application existed, which is the sentence in the
  spec, measured rather than inferred;
- the document does not scroll horizontally;
- the long text's own box stays inside its column.

It runs in both the `wide` (1280px) and `wrapped` (1100px) projects, since a wrapped grid distributes
width differently and is where a layout break would show first.

**The class-substring assertions go.** Once geometry is measured, asserting `break-words` and
`line-clamp-` adds no detection and reads as evidence it is not. The same test keeps the assertion
the spec does make — the card contains the value — which is the "A very long value does not distort
the board" scenario's first clause.

**The ledger entry is corrected and closed**, including the two misstatements above.

Not in this change:

- Any promise about how many lines a value is shortened to. That would be a new requirement, and the
  spec deliberately leaves the depth open.
- Changing `ApplicationCard`'s classes or any other rendering. If the measurement fails, that is a
  defect to report, not something this change expects.
- The three deferred error-boundary items (`app/global-error.tsx`, narrowing `app/error.tsx`, its
  wording). Unrelated, and recorded elsewhere.

## Capabilities

### New Capabilities

<!-- None. -->

### Modified Capabilities

<!-- None. No requirement changes: "A long company name or position SHALL wrap or be shortened
     within the card, and SHALL NOT change the width of its column or the layout of the board"
     already says what this change measures. Only the evidence changes, so the change declares
     skip_specs: true in .openspec.yaml rather than inventing a delta to satisfy validation. -->

## Impact

- **Code**: no production code. `e2e/` gains a spec for the long-value case; `e2e/reset-board.ts`
  gains the insert helper if the existing one does not fit;
  `components/board/ApplicationCard.test.tsx` loses the two class assertions and keeps the value one.
- **Data**: no schema change. The test inserts a row directly into `e2e.db`, as
  `e2e/move-card.spec.ts` already does, and `resetBoard` removes it like any other addition.
- **Dependencies**: none added.
- **Tests**: net change is one e2e test gained, two jsdom assertions lost. The unit count drops by
  none — the test that held them keeps its remaining assertion.
- **Docs**: `docs/reviews/decisions.md` closes `R20260927-6` and corrects what it claimed about e2e
  coverage. No `spec.md` change: the data model and the requirements are untouched.
