# Design

## Context

See `proposal.md` — Why. What shapes the approach is that the previous change left the pieces in
place on purpose:

- `lib/applications/status-age.ts` exports `daysInStatus(statusChangedAt, now)`, a pure function of
  two instants with no clock inside, written so item 6 could threshold it rather than re-derive it.
- `now` is already a required prop with no default, threaded from `app/page.tsx` through `Board`,
  `BoardColumn` and `DraggableCard` to `ApplicationCard`. Nothing new has to be plumbed.
- The card's badge row is `<p className="mt-2 flex">` holding one `shrink-0` pill, which is the row
  the flag joins. The pill pattern is `<span aria-hidden>` for the abbreviation plus
  `<span className="sr-only">` for the words, because a bare `<span>` carries ARIA's
  name-prohibited `generic` role.
- `spec.md` carries a change-log entry from 2026-10-02 warning that a colour safe on white can fail
  on a tint — written for this change, because this is the one that picks a colour on a tint.
- `e2e/long-value-layout.spec.ts` measures column widths in two viewports and now inserts both a
  200-character company name and a four-digit badge row.
- The seeded e2e board holds `e2e-applied` (Applied, far past the threshold) and `e2e-wishlist`
  (Wishlist, also old) — a positive and the exact negative the rule most easily gets wrong.
- `useBoardCards`'s optimistic `move` change already sets both `status` and `statusChangedAt`, so
  both halves of this rule are already correct across a move with no further work.

## Goals / Non-Goals

**Goals:**

- One expression of the rule, next to the count it thresholds, callable without a DOM.
- A flag that survives having its colours taken away.
- Correct across a move in both directions, with no new optimistic handling.

**Non-Goals:**

- No configurable threshold. 14 days is what `spec.md` specifies; a setting would need somewhere to
  store it and is not in the MVP.
- No staleness anywhere but the card. Counting stale applications in the header is MVP item 7's
  territory, and filtering or sorting by it is out of scope for the MVP entirely.
- No second notion of elapsed time. The predicate calls `daysInStatus`; it does not subtract dates.
- No change to the day count's own appearance.

## Decisions

### The rule is a predicate beside the count, taking the count's inputs

`lib/applications/status-age.ts` gains:

```
const STALE_AFTER_DAYS = 14
hasNoMovement(application: { status, statusChangedAt }, now: Date): boolean
```

It returns `status === APPLIED && daysInStatus(statusChangedAt, now) >= STALE_AFTER_DAYS`.

Taking a structural subset of the application rather than the whole row keeps it callable from a
test without building a `JobApplication`, and keeps it honest about what it reads: two fields, no
more. It takes `now` for the same reason `daysInStatus` does — the card renders twice, on the server
and again on hydration, and a clock inside would make the flag flicker.

Alternative considered: a `staleness` field computed in `page.tsx` and passed down as data. Rejected
for the reason the same alternative was rejected last change — the board moves `JobApplication[]`
through the hook, the reducer and `groupApplicationsByStatus`, and widening that shape to carry a
derived boolean gives the optimistic move a second thing to keep in step with `status`.

### `>= 14`, and why that is the inclusive edge

`spec.md` words the rule twice — "more than 14 days" and "`statusChangedAt` older than 14 days" —
and those two readings differ by a day. The deciding argument is not the English but the display:
the card already shows "14d", and a card reading 14 days that is *not* flagged while one reading 15
is looks arbitrary to the person reading it, with nothing on the card to explain the difference.
`>= 14` makes the badge and the flag agree.

It also matches what the floored count means. `daysInStatus` returning 14 covers everything from
exactly 14 days to just under 15, so every such card is at least 14 days old — "older than 14 days"
in the spec's own words, for all but the single instant at exactly 14 days.

Recorded in `spec.md` rather than left to the code, because the next person to read "more than 14
days" will reach the same fork.

### The flag is its own badge, and its own words

A second pill in the same row: `aria-hidden` short text "No movement", and an `.sr-only` sentence
that says what it means for a screen reader. Visible text is not a style choice — colour as the only
carrier fails WCAG 1.4.1, and the scenario "shown without colour" is in the spec to hold that.

The announced sentence is **"No movement for 14 days or more"**, and its shape is load-bearing
rather than a matter of taste. `e2e/days-in-status.spec.ts`'s "every card carries exactly one badge"
counts elements whose text matches `/ in (Wishlist|Applied|Interview|Offer|Rejected)$/` and expects
one per card. A natural phrasing like "No movement — 280 days in Applied" would end in " in Applied",
be counted as a second day badge, and fail that test for a reason that has nothing to do with the
defect it guards. Ending the sentence on the threshold rather than on the status name avoids the
collision and says the rule out loud.

It does not repeat the day count, either: the neutral badge beside it already announces that, and
two sentences carrying the same number is noise to someone listening rather than looking.

Alternative considered: recolouring the day badge to amber and appending "· Stale". Rejected — one
element would then answer both "how long" and "is this a problem", and the two have different
lifetimes: the count changes every day, the flag flips once. The user chose the separate pill.

Alternative considered: an amber ring on the whole card as well. Rejected for now — it is the most
visible at a column-scanning glance, but it is pure colour, so it would add nothing a colour-blind
reader can use while adding a geometry change to measure. The pill is the carrier; a ring could be
added later without changing the rule.

### The colour is computed against the background it sits on

Amber on an amber tint, and the ratio is computed before it is written, against the background it
will actually have — which is exactly what the 2026-10-02 `spec.md` entry asks for, since that entry
exists because the day badge inherited a colour that was safe on white and failed on `slate-100`.
The flag's text must clear 4.5:1 on its own tint at 12px, with margin for Tailwind 4's oklch values
not being the sRGB hexes the ratio is computed from. If the first pairing does not clear it, the
text colour darkens rather than the tint lightening, because the tint also has to stay
distinguishable from the neutral badge beside it.

### Nothing new for the optimistic move

The `move` change already sets `status` and `statusChangedAt` together, and the flag is derived from
both at render. So moving out of Applied unflags the card, moving into Applied leaves it unflagged
with a fresh clock, a failed move restores both fields with the server list, and a drop on the card's
own column never reaches `moveCard` at all. Four of the delta's scenarios are satisfied by
construction; they get tests because "satisfied by construction" is a claim about code that can
change, not a property of the universe.

## Risks / Trade-offs

- **A second pill in the row could change the measured layout** → `e2e/long-value-layout.spec.ts`
  measures column widths in two viewports, and the flag gets **two** rows of its own there: a stale
  card with an ordinary company name, which is the flag measured alone, and a stale card with a
  200-character name, which is the worst case. Two rows rather than one combined card, because one
  card carrying both could not say which of the two moved a column — the reason that file already
  records about its own control test, and the reason a first draft of this plan got wrong by putting
  both on one card while citing it.
- **"No movement" is longer than "280d", so the row is wider on a flagged card** → the row gains
  `flex-wrap` so the second pill drops to a line of its own instead of overflowing. It does not wrap
  today: `<p className="mt-2 flex">` is `nowrap`, and two `shrink-0` children in a non-wrapping row
  overflow once they exceed the content width — the same mechanism that overflowed the heading before
  its clamp was added. Wrapping makes the card taller, which the column absorbs; what must not change
  is width, which is what task 4.4 measures.
- **The threshold's edge is a judgement, and a reader may expect the other one** → stated in
  `spec.md` with the reasoning, and pinned by tests either side of the edge — 13 days false, 14 days
  true — so the choice cannot drift silently.
- **The seeded e2e rows are far past the threshold and will drift further** → that is harmless here,
  because the assertion is "flagged", not a number. The boundary cases use rows inserted at a
  controlled age, the way `days-in-status.spec.ts` already does, so they do not depend on when the
  suite runs.
- **`hasNoMovement` takes a structural type, so a future caller could pass a shape that merely looks
  right** → acceptable: the two fields it names are the two the rule is defined on, and a wider
  parameter would only move that risk rather than remove it.
