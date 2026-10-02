# Design

## Context

See `proposal.md` — Why. What shapes the approach:

- **The page has two lists, and only one of them is current.** `app/page.tsx` reads the stored rows
  and passes them to `Board`; `useBoardCards` wraps them in `useOptimistic` and returns `shown`,
  which carries an unsaved move or deletion. `Board` already derives `grouped =
  groupApplicationsByStatus(shown)`. Anything computed in `app/page.tsx` is computed from the
  *server* list and is therefore one revalidation behind the cards.
- **`groupApplicationsByStatus` already owns the "unrecognised status" rule.** It drops a row whose
  stored status is not one of the five, with an entry for every status so a caller never branches on
  a missing key. The board's cards are exactly the rows that survived that filter.
- **The optimistic reducer already covers both writes.** `applyChange`'s `move` branch rewrites
  `status`, and its `remove` branch filters the row out. Both figures are functions of status alone,
  so neither needs new optimistic handling, and a failed write drops the change and falls back to the
  server list — the same mechanism that returns a card to its column.
- **The pill pattern on the card is an abbreviation pattern.** `BoardColumn`'s count and the card's
  badges split into an `aria-hidden` span for the short form and an `.sr-only` span for the words,
  because a card has no room for "12 days in Interview". A line spanning the board does have room.
- **`spec.md`'s 2026-10-02 entry on contrast applies to any tinted surface**, and this change adds
  one if the summary gets a background.
- `app/page.tsx` takes `now` once per request and threads it as a required prop with no default, for
  the day count. Neither figure here is a function of time.

## Goals / Non-Goals

**Goals:**

- One place that decides what is counted, so the total cannot drift from the number of cards.
- Figures that move with an optimistic card change for free, not by a second mechanism.
- Both figures legible as words on screen, so no second form has to be maintained for screen readers.

**Non-Goals:**

- No change to how the board, the columns, the cards or their badges behave. This change adds a
  region above them and reads the list they already read.
- No new data, query, action or dependency. Nothing is stored and nothing is fetched.
- No statistic beyond the two `spec.md` names. An offer rate, a count of stale applications, a
  per-column percentage or anything derived from `appliedDate` is a scope change first.
- No history of status transitions. That would make "ever reached interview" answerable and is a
  data-model change `spec.md` does not ask for; see the first decision below.

## Decisions

### "Reached interview" means *currently* Interview or Offer

The counted set is `status === INTERVIEW || status === OFFER`.

The data model stores one status per application plus `statusChangedAt`. There is no transition log,
so for a Rejected application the stored data cannot distinguish "rejected after two interviews" from
"rejected without a reply". Three readings were on the table:

- **Interview + Offer** — chosen. Every application it counts provably reached interview. It
  undercounts: an interviewed-then-rejected application is not counted. That is a known and bounded
  error in one direction, and the summary says what it counts so the reader can allow for it.
- **Interview + Offer + Rejected** — rejected. It treats every rejection as post-interview, so a
  board of applications that were all silently rejected at the Applied stage would report a high
  interview rate. An error in the flattering direction, on the one figure whose job is to tell the
  person whether the search is working, is the worse failure.
- **A transition log in `prisma/schema.prisma`** — rejected for this change. It is the only way to
  make the figure exact, it is a data-model change with its own `spec.md` entry and migration, and
  MVP item 7 asks for "simple stats". If the undercount ever matters, it is its own change.

The undercount is why the spec requires the counted set to be legible in the summary itself rather
than only here: a person who has rejections on the board needs to know the percentage does not
include them.

### The share is measured against every tracked application

Denominator = the total shown beside it, Wishlist included.

The alternative was a truer conversion rate — exclude Wishlist, since a Wishlist card is a bookmark
rather than an application that was sent, which is the same argument MVP item 6 uses to refuse to
flag an old Wishlist card. It was rejected on the grounds of the line it appears in: the summary puts
a total and a percentage side by side, and a percentage taken against a different set than the number
next to it is a line that cannot be checked by eye and needs a third label to explain itself. One set,
two figures.

Recorded in `spec.md`'s change log, because the code will read `total` and nothing in it will say
that the other reading was considered.

### The figures are derived from the grouped board, in the client tree

A new `lib/applications/stats.ts`:

```
interface BoardSummary {
  total: number
  reachedInterview: number
  /** null when there is nothing to measure — see below. */
  percentReachedInterview: number | null
}

summariseBoard(grouped: ApplicationsByStatus): BoardSummary
```

It takes the **grouped record**, not the flat list. That is the decision worth the words: the spec
requires the total to equal the number of cards on the board, and the grouped record *is* the cards.
Counting it makes that requirement structural — there is no second filter that could disagree with
`groupApplicationsByStatus` about which rows are recognised, and a row with an unknown status is
excluded from both figures because it was already excluded upstream.

The alternative, `summariseApplications(applications)` filtering with `isApplicationStatus` itself,
was rejected for exactly that: two call sites applying the same rule, with nothing making them agree,
and the failure mode is a total that is one higher than the cards for a reason no test would be
looking for.

`Board` renders the region from the `grouped` it already computes. Not `app/page.tsx`: that has only
the server list, so a card moved into Interview would sit in its new column under a percentage that
had not changed yet. The board already refuses that trade for the day badge — `spec.md`, 2026-10-02,
"the optimistic move resets the badge as well as the column" — and this is the same situation one
level up. Lifting `useBoardCards` into `page.tsx` is not available: it is a client hook and the page
is a Server Component.

Placement inside `Board`: above the existing failure `role="alert"` paragraph and the column grid, so
reading order is summary → failure message → columns.

### An empty board has no percentage, and the type says so

`percentReachedInterview` is `number | null`, `null` exactly when `total === 0`.

A nullable number rather than `0`, `-1` or `NaN`: the empty case then has to be handled at the call
site or the code does not type-check, which is the same reason `now` was made a required prop in the
day-count change. `0` would type-check and render "0% reached interview" on an empty board, which is
the one output the spec forbids — and nothing would have failed.

### Rounding is to whole percent, clamped away from both ends

`Math.round(100 * reached / total)`, then: a result of `0` becomes `1` when `reached > 0`, and a
result of `100` becomes `99` when `reached < total`.

Both clamps are reachable: 1 of 201 rounds to 0%, and 200 of 201 rounds to 100%. Reporting "0%
reached interview" while one did is a false statement about the thing the person most wants to see,
and "100%" while one application is still open is the same error mirrored.

Alternatives: one decimal place (rejected — the figure is a rough gauge, and "0.5%" in a one-line
summary is precision the number does not carry), or flooring (rejected — it only fixes the 100% end,
and makes 2 of 3 read 66% where 67% is nearer). The cost of the clamp is accepted and named: 1 of 201
and 2 of 201 both read 1%. A gauge that cannot say "none" when there is one is worth more than
distinguishing those two.

### The visible text is the accessible text

The region is a named landmark holding two figures written out in words — the number with the word
"applications", and the percentage with what it counts. No `aria-hidden` / `.sr-only` pair.

That pair exists on the cards and column badges because those show an abbreviation ("12d", a bare
"3") that a screen reader must not read as-is. A line across the top of the page has room for the
words, and one text node that is both shown and announced cannot drift out of step with its twin —
which is a real failure mode here, since every figure in this region is a number whose label is the
only thing making it meaningful.

A `<dl>` of `<dt>`/`<dd>` pairs was considered and rejected: it pairs label and value in the
accessibility tree, which the written-out text already does, at the cost of announcing a list
structure to walk through for two items.

The region gets `aria-label`, making it a landmark like the five columns, so it is reachable by the
same navigation and comes before the cards.

### Layout is measured in a browser, never in jsdom

The spec's layout guarantees — no column changes width, no horizontal scroll, whatever figures the
region holds — are asserted **only** in Playwright. Nothing at component level makes a claim about
layout.

Vitest runs `environment: "node"` with jsdom opted into per file, and jsdom has no layout engine: every
element measures zero. A component test phrased as "renders without overflowing" or "wraps rather than
forcing horizontal scroll" can therefore only be implemented as an assertion on a class substring, and
`docs/reviews/decisions.md` → `R20260927-6` already deleted exactly those from this project, on the
grounds that they "could not fail for any reason the spec cares about". A test that reads as evidence
but cannot fail is worse than no test, because it stops anyone from writing the real one.

So the four-digit total is seeded into `e2e.db` and measured in a real browser. That is cheap here and
the first draft of this design wrongly said it was impossible: `e2e/long-value-layout.spec.ts` already
inserts rows straight into the database with better-sqlite3 for its four-digit *day count* case, and
`resetBoard` deletes every row and restores the snapshot in one transaction, so a thousand inserts in
one `db.transaction` use the same mechanism and cost nothing extra to clean up.

### The empty board reads "No applications yet"

Fixed here rather than left to the implementing session, because three tasks assert the exact string
and a wording chosen twice is a wording that disagrees with itself. It mirrors `BoardColumn`'s own
empty state ("No applications yet"), so the page does not have two spellings of the same idea.

### Both figures are written out; nothing in this region is abbreviated

The decision above — visible text is the accessible text — only holds while nothing here is shortened,
so the spec now says so normatively and the "An abbreviation is not what is announced" scenario was
removed. It was conditional on an abbreviation this design rules out, so nothing could ever have
tested it, and a scenario with no possible test is a gap dressed as coverage. The guarantee it was
reaching for is now a requirement sentence with a scenario behind it that asserts the words are there.

### The region is not a live region, and that is a decision

The figures change silently when a card moves or is deleted. Nothing announces the new percentage.

Three reasons, in order of weight. The spec asks for the figures to be *readable* as what they mean,
not announced on change, so making the region live would be behaviour `spec.md` does not ask for —
which the scope rule in `AGENTS.md` says needs a spec change first. A move is already announced:
dnd-kit's own live region says the card was dropped over a column, and the card's badge and flag
change silently beside it for the same reason. And a second announcement on every move would arrive
after the first, describing a whole-board statistic nobody asked about at the moment they moved one
card — the classic way a live region becomes something people switch off.

Raised as an open question by the 2026-10-02 review (`R20261002` open questions) and answered here
rather than left implicit. Reversible: if the summary should announce, it is an `aria-live="polite"`
on the region plus a spec entry saying when.

### No `now`, deliberately

Neither figure is a function of elapsed time, so `now` is not threaded into the region and
`summariseBoard` does not take it. Stated here because every other derived number on this board takes
`now` as a required argument, and the next person to add a figure to this line will reasonably assume
this one does too.

## Risks / Trade-offs

- **The figures get moved to `app/page.tsx` later, for "server-rendered purity", and silently go a
  revalidation stale.** → A board-level test with the actions mocked asserts the percentage changes
  on an optimistic move before the write settles. Moving the computation to the server list breaks it.
- **A move that changes no figure looks like a bug that was not caught.** Wishlist → Applied leaves
  both figures alone, correctly. → Asserted as its own test, so the next reader sees it was intended.
- **A tinted background repeats the 2026-10-02 contrast failure.** → If the region gets a tint, the
  ratio is computed against that tint before the classes are written and recorded in a comment, as
  that entry requires.
- **A four-digit total is a thousand rows, which is a slow test and a board nobody will ever have.**
  → Paid anyway, once, in e2e. It is the only place the guarantee can be measured, and the test is one
  transaction plus one page load. The board it measures is unrealistic; the arithmetic that could
  widen a column is not.
- **The undercount is permanent until a transition log exists.** A person who interviews and is then
  rejected sees the percentage fall. → Named in the summary itself and in `spec.md`, rather than
  mitigated.

## Open Questions

None.

The two definitional choices this change turns on — what counts as having reached interview, and what
it is measured against — were settled with the user before the artifacts were written and are recorded
above.

Two more were settled with the user after the 2026-10-02 proposal review raised them, and are recorded
above rather than left here: how "Large figures do not distort the board" gets a check that can fail
(e2e, a seeded four-digit total), and what to do with the untestable abbreviation scenario (removed,
with the guarantee moved into the requirement text).
