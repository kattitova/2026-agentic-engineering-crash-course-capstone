# Proposal

## Why

An independent review pass (`docs/review-log.md`, 2026-09-21) found no critical defects in the
archived `render-kanban-board` change, but it did find one crash path, one layout hazard, four
spec requirements protected by nothing but manual checking, and several accessibility gaps. None
of those were spec violations, which is why the change was archived correctly — they are cases
the spec never spoke about. They are cheapest to settle now, before drag-and-drop adds the
board's first client component on top of the same code.

The review also asked three questions the reviewer deliberately left to the author. All three are
answered here.

## What Changes

**The board survives bad data.** `groupApplicationsByStatus` currently indexes a
`Record<ApplicationStatus, …>` with whatever string the database returned. TypeScript cannot
catch this — the type asserts the key exists — and SQLite does not enforce the enum, so a row
written by a seed script or a hand edit throws inside a Server Component and takes the whole page
down. An unrecognised status now drops that one card instead.

**A card stays readable at any value length.** Nothing bounds `company` or `position`, so a long
unbroken token widens its grid column and distorts the board. The card gets text wrapping and
truncation, which makes the existing "card identifies the company and the role" requirement hold
for any input rather than only for well-behaved input.

**The posting link is re-checked where it is rendered.** Every current write path validates the
URL scheme, but `prisma/seed.ts` and direct database edits do not, and a stored `javascript:` URL
would be one click from executing. The card reuses the existing scheme check before rendering an
anchor.

**Two accessibility gaps close.** The column count badge is a bare number with nothing tying it to
its heading, and every card's posting link has the identical accessible name, so a link list reads
as "View posting" repeated once per card.

**The read path stops being a server action.** `app/actions/applications.ts` carries a file-level
`"use server"`, which makes every export a public endpoint — including `listApplications`, which
is a query, not a mutation. It moves to `lib/applications/queries.ts` as an ordinary async
function. This also makes the project's error convention exact and exception-free: server actions
(mutations) return `ActionResult` and never throw; data loaders are ordinary functions that throw,
and the exception is caught by an error boundary. That boundary does not exist yet, so this change
adds `app/error.tsx`.

**The board reads its data per request, not per build.** Found while implementing this change, and
missed by the review: `npx next build` reports `/` as `○ (Static) prerendered as static content`.
Prisma runs on `better-sqlite3`, a synchronous driver, so the query completes during prerendering
and the board is baked into static HTML at build time. The review verified this requirement against
`app/page.tsx` and found it satisfied, which holds in `next dev` but not in a production build. A
change made outside the app — a seed script, Prisma Studio, a direct edit — would never appear.
`revalidatePath("/")` covers changes made *through* the app, so drag-and-drop is unaffected; the
"data changed elsewhere" scenario is the one that fails.

**Four spec requirements gain regression tests.** The count badge, the empty-column message, the
conditional posting link and the card's company/position can each be deleted today with
`npm run verify` staying green. Covering them needs a DOM test environment, which the project does
not have: `vitest.config.mts` runs in `node` and only collects `*.test.ts`. This change adds
jsdom and React Testing Library and widens the collection to `*.test.tsx`.

Answers to the reviewer's open questions:

- The disabled "Add application" button stays, for layout fidelity, and becomes functional in the
  add-application change. The deviation is recorded in the `spec.md` Spec change log, which is
  what the `AGENTS.md` "Scope" rule asks for.
- `listApplications` does not join the `ActionResult` convention; it leaves the server-action file
  instead, which states the convention more precisely than an exception would.
- Field length limits are **not** in this change. They belong with the form in add-application,
  where validation first meets a real user and where `maxLength` naturally lives. No gap is left
  open in the meantime: `createApplication` and `updateApplication` have no caller today.

Not in this change:

- Maximum lengths for `company`, `position`, `link` and `notes`, and the corresponding entries in
  the `spec.md` data model. Deferred to add-application.
- Anything about drag-and-drop. The reviewer's concurrency and keyboard-sensor notes are decisions
  for the add-drag-and-drop change, not defects in shipped code.

## Capabilities

### New Capabilities

<!-- None: this hardens the existing board capability. -->

### Modified Capabilities

- `kanban-board`: adds a requirement that the board tolerates an unrecognised stored status.
  Modifies five existing requirements so they hold under conditions the original wording left
  open — the column count is announced to assistive technology, the posting link names its card
  and is re-checked before rendering, the card stays readable at any value length, the
  left-to-right column order is stated as a wide-viewport guarantee rather than an unconditional
  one, and the data is read when the page is requested rather than when it is built.

## Impact

- **Code**: `lib/applications/board.ts` (status guard); `components/board/ApplicationCard.tsx`
  (wrapping, scheme check, per-card link name); `components/board/BoardColumn.tsx` (count label);
  new `lib/applications/queries.ts` (which also opts the read out of prerendering); new
  `app/error.tsx`; `app/page.tsx` changes one import.
- **Server actions**: `listApplications` is removed from `app/actions/applications.ts`. The four
  mutating actions are untouched.
- **Data**: no schema change, no migration, no `prisma db push`. The board page moves from static
  to per-request rendering, so the built output no longer contains application data.
- **Dependencies**: three devDependencies added — `jsdom`, `@testing-library/react`,
  `@testing-library/jest-dom`. No runtime dependency.
- **Tests**: `vitest.config.mts` moves to the jsdom environment and collects `*.test.tsx`; new
  component tests for the card and the column; the existing `dotClass` assertion is strengthened.
  `npm run verify` keeps its three steps and now covers rendering.
- **Docs**: two entries in the `spec.md` Spec change log — the disabled button, and the
  mutation/loader convention.
