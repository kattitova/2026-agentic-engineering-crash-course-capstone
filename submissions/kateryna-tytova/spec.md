# Job Application Tracker — Specification (v1)

> This document is written and committed BEFORE any code. That's intentional:
> the capstone rubric only credits specification-driven development when the
> commit order shows the spec came first. If reality diverges from this plan
> during the build, add a note to "Spec change log" below instead of silently
> rewriting history.

## Goal

A small personal tool for tracking job applications on a Kanban board, so
nothing gets lost, it's clear which stage each application is at, and the
overall progress of the job search is visible at a glance.

## Stack

- Next.js (App Router) + TypeScript
- Prisma ORM + SQLite (file-based database, no external services — just
  `npx prisma db push` and it works locally)
- Server Actions for create/read/update/delete
- `@dnd-kit` for drag-and-drop between columns
- Tailwind CSS for styling
- Vitest — unit tests for pure functions
- Playwright — e2e test for dragging a card between columns

## Data model

`JobApplication`:

| Field       | Type                                                        | Notes                                    |
| ----------- | ----------------------------------------------------------- | ---------------------------------------- |
| id          | string (cuid)                                               | auto-generated                           |
| company     | string                                                      | required; at most 120 characters         |
| position    | string                                                      | required; at most 120 characters         |
| status      | enum: WISHLIST \| APPLIED \| INTERVIEW \| OFFER \| REJECTED | defaults to WISHLIST                     |
| link        | string?                                                     | link to the job posting; http(s) with a domain host, no credentials, at most 512 characters |
| notes       | string?                                                     | free text; at most 2000 characters       |
| appliedDate | DateTime?                                                   | set on the first transition into APPLIED |
| statusChangedAt | DateTime                                                | defaults to now(); updated only when `status` changes |
| createdAt   | DateTime                                                    | auto                                     |
| updatedAt   | DateTime                                                    | auto                                     |

The lengths are measured after trimming and enforced in
`validateApplicationInput` (`APPLICATION_LIMITS`), not in `prisma/schema.prisma`:
SQLite ignores the length on a `VARCHAR(n)`, so a schema-level limit would state
a constraint the database does not apply.

## MVP scope (in)

1. Kanban board with columns per status.
2. Add a new application (form: company, position, link, notes).
3. Drag a card between columns → updates status (and `appliedDate`, if this
   is the first transition into APPLIED).
4. Edit and delete an application.
5. A badge showing "N days in this status" on each card (computed from
   `statusChangedAt`).
6. Visual flag for "stale" applications (more than 14 days in APPLIED with
   no movement, i.e. `status = APPLIED` and `statusChangedAt` older than
   14 days).
7. Simple stats above the board: total applications, % that reached
   interview stage.

## Deliberately out of scope for MVP

- Authentication / multiple users — this is a single-user project, no login.
- Email/push reminders.
- Integrations with external job-board APIs.
- Pixel-perfect mobile responsiveness — it just needs to work reasonably well.

## Definition of Done

- `npm run verify` (lint + typecheck + unit tests) passes with no errors.
- There is at least one e2e test covering moving a card between columns, and
  it passes.
- The project runs from a fresh clone with no external services:
  `npm install && npx prisma db push && npm run dev`.
- `AGENTS.md` exists, and the commit history shows at least one case where a
  rule from it visibly changed the agent's behavior (a "before" commit and an
  "after" commit).
- There is at least one review pass by a separate agent session
  (maker ≠ checker) with an explicitly recorded outcome (what it found, or
  that it found nothing critical).

## Spec change log

_(Add entries here as work progresses: what changed relative to this initial
plan, and why. Empty is fine on Day 0.)_

- **2026-09-13 — added `statusChangedAt` to `JobApplication`.** MVP items 5
  ("N days in this status") and 6 ("stale" flag) need the time of the last
  status change. `updatedAt` can't be used for that: it also changes when
  company, position, link or notes are edited, which would reset the counter
  and hide stale applications. `statusChangedAt` defaults to `now()` on
  create and is updated only when `status` actually changes (moving a card
  to the column it's already in doesn't count).

- **2026-09-27 — the disabled "Add application" button stays until MVP item 2.**
  A review pass noted that the header's inert button is functionality the
  kanban-board spec does not require, and that the "Scope" rule in `AGENTS.md`
  asks for spec.md to be updated first. Recording the decision here rather than
  removing the control: it keeps the header faithful to the intended layout, it
  cannot be activated, and it becomes the real trigger in the add-application
  change. If that change is dropped, the button goes with it.

- **2026-09-27 — read path and write path have different error shapes, on
  purpose.** Server actions are mutations: they validate their arguments,
  return `ActionResult` (`{ ok: false, error }`) and never throw. (Stated here
  on this date, and only made true on 2026-10-01 — see that entry.) Data loaders
  are ordinary async functions in `lib/applications/`: they throw, and
  `app/error.tsx` shows the failure and offers a retry. `listApplications` moved
  out of `app/actions/applications.ts` to make this exact — that file carries a
  file-level `"use server"`, which had published a read query as a callable
  endpoint. `app/error.tsx` is a new file this plan did not list; it is the half
  of the convention that makes a throwing loader a deliberate choice rather than
  an unhandled one. Its limit is known and accepted: React error boundaries need
  a Suspense boundary to recover into, so a failure on the very first request is
  still served as Next's error page. Giving that case a boundary would mean
  putting a loading placeholder in the first paint, which the board's spec
  forbids.

- **2026-09-27 — the board page renders per request, not at build time.**
  Found while hardening the board: `next build` reported `/` as static, because
  Prisma runs on `better-sqlite3` and a synchronous driver completes its query
  during prerendering. The data was therefore frozen at build time, which breaks
  "the board shows the applications as they are stored at the moment the page is
  served" for any change made outside the app. `listApplications` now calls
  `connection()` before querying, and `/` builds as dynamic.

- **2026-09-27 — MVP item 3 (drag a card between columns) is implemented.**
  Cards move by pointer and by keyboard, and the status change is stored. Three
  decisions are worth recording because none of them is obvious from the code.
  First, dnd-kit's keyboard sensor moves a fixed 25px per arrow key, which is a
  fraction of a column, so it is given a column-aware `coordinateGetter`; the
  rectangle arithmetic lives in `lib/applications/move.ts` and resolves both
  axes, because the grid wraps below 1280px and the next column in funnel order
  can be on the next row. Second, a card whose write is outstanding cannot be
  moved again — the set of writing cards is tracked, not a single id, so a
  second card's move cannot release the first. Third, `updateApplicationStatus`
  revalidates on its `NOT_FOUND` branch, so a card whose row was deleted
  mid-move is removed rather than restored to a column it no longer belongs to.
  This also satisfies the Definition of Done's e2e requirement: the Playwright
  suite moves a card with the keyboard and asserts the move survives a reload,
  at both a single-row and a wrapped viewport.

- **2026-09-29 — MVP item 2 is implemented; the placeholder button is now real.**
  The "Add application" button opens a modal dialog over the board with the four
  fields this spec names. A new application starts in WISHLIST; there is no
  status picker, because moving the card is what drag-and-drop is for. This
  closes the 2026-09-27 note above: the disabled control is gone and the change
  it was waiting for has landed.

- **2026-09-29 — every stored field has a maximum length.** company and position
  at 120 characters, link at 2048 (the conventional URL ceiling), notes at 2000.
  Recorded in the data model above. The limits live in `validateApplicationInput`
  because both write paths already share it, and because the form's `maxLength`
  attributes are a convenience rather than the guard - they do not exist for
  `prisma/seed.ts` or a direct call. This resolves the last unresolved Major from
  the 2026-09-21 review, which was deferred to this change on the grounds that no
  gap was open while `createApplication` had no caller.

- **2026-09-29 — dismissing the add form during submission does not undo it.** A review pass asked
  whether Cancel and Escape should be blocked while a submission is in flight. They are not.
  Closing the dialog unmounts the form but does not cancel the server action, so an application
  submitted and then "cancelled" is still stored and appears on the board. Recorded rather than
  fixed: the window is milliseconds against a local SQLite file, and keeping Escape working is
  worth more than closing it — a modal that will not close on Escape is its own accessibility
  problem. Undoing a write needs delete, which is MVP item 4.

- **2026-10-01 — "a server action never throws" is now carried by the
  functions, not only by this document.** The convention above was written on
  2026-09-27 and enforced by nothing. Three of the four actions could let a
  storage failure escape: `updateApplicationStatus` had no `try`/`catch` at all,
  and `updateApplication` and `deleteApplication` caught `P2025` and rethrew the
  rest. `useCardMoves` awaited the first of those bare, so a locked database
  during a card move was an unhandled rejection inside a transition — which
  React sends to `app/error.tsx`, replacing the board with a message about a
  failed *read*. That is the defect the 2026-09-29 review found in the add form
  (`R20260929-1`), in a path that review never looked at. Every action now ends
  in a catch-all returning `ActionResult`, so the type is a promise the function
  keeps and MVP item 4's forms inherit it without having to know the rule
  exists. Each `try` holds the storage call alone: reporting a failed
  `revalidatePath` as "the application was not added" would say the opposite of
  what happened.

- **2026-10-01 — a catch-all must let Next's own throws through.** `redirect()`,
  `notFound()`, `forbidden()` and `unauthorized()` signal by throwing, so a
  catch-all swallows them and the redirect silently never happens while the
  action reports a failure for a write that succeeded. No action calls one
  today; `unstable_rethrow` from `next/navigation` runs first in every catch
  anyway, because MVP item 4 is where a redirect after saving is the natural
  thing to add and the person adding it would have no way to see what broke it.
  Recorded rather than left as a code comment because it is a constraint on
  every action written from here on.

- **2026-10-01 — editing an application deliberately leaves `status`,
  `appliedDate` and `statusChangedAt` alone (MVP item 4).** The edit form offers
  only company, position, link and notes. Status is owned by the drag-and-drop
  path, which is also what decides `appliedDate` and `statusChangedAt`; a form
  that could set status would give those three fields a second owner and a
  second set of rules, and correcting a typo would move the card or restart the
  "N days in this status" clock that MVP items 5 and 6 are built on. The
  guarantee is structural rather than conditional: `updateApplication` writes
  whatever `validateApplicationInput` returned, which is exactly those four
  fields. Pinned by a test on the action and measured end to end against the
  stored row, because a reset clock is invisible on the board.

- **2026-10-01 — deleting an application is confirmed and final; no undo
  (MVP item 4).** Nothing restores a deleted application: an undo would need
  soft deletes in `prisma/schema.prisma`, which is a data-model change this item
  does not justify on its own. A confirmation step is what stands in for it, and
  it names the application so the person can see which card they are about to
  lose. If an undo is wanted later, it is its own change with its own schema
  entry here.

- **2026-10-01 — `updateApplication` and `deleteApplication` revalidate the
  board when the row turns out to be gone.** `updateApplicationStatus` already
  did; these two returned "Application not found" without it, so a card for a
  row somebody deleted elsewhere stayed on the board until a manual reload —
  against both of MVP item 4's specs, which say the card must not be left there.
  One `notFound()` helper now owns that branch for all three actions.
  Deliberately not on the catch-all branch: there the write provably did not
  happen, and refetching the board would say otherwise.

- **2026-10-01 — a dialog closes when the person closes it, not when its row
  leaves the list.** The board first derived each dialog's open state from the
  application still being in the shown list. The not-found branch of
  `updateApplication` revalidates the board, so the row left the list in the
  same breath as the result arrived: the form was unmounted with its
  "Application not found" message still in it, and the person saw a dialog close
  and a card vanish — which is what a save that worked looks like. Found by the
  2026-10-01 review pass (`R20261001-6`) and reproduced at board level before
  being fixed. The board now holds the application itself. Nothing is lost by
  that: the form is keyed by the application and seeds its fields once per
  mount, so it never re-read the looked-up row anyway.

- **2026-10-01 — the delete confirmation carries no pending state.** The board
  closes it before starting the write, so a second confirmation is impossible
  because the control no longer exists, not because it is disabled. The
  `application-delete` requirement ("A deletion in flight cannot be started
  again") is therefore met structurally, and the task's original wording — a
  control disabled while writing — described a mechanism that would have been a
  state the application cannot produce, with two tests asserting it. Raised by
  the same review pass as `R20261001-7`.

- **2026-10-02 — "N days in this status" counts whole elapsed days, computed
  server-side (MVP item 5).** `floor((now − statusChangedAt) / 24h)`, clamped at
  zero, from one instant taken in `app/page.tsx` per request. Calendar days were
  the alternative and were rejected: they need a timezone, and the one the board
  renders in is not guaranteed to be the viewer's, so the number could be wrong
  by one for a reason the person cannot see. Elapsed days cannot be, and they
  make MVP item 6's rule exactly what this file already writes — `statusChangedAt`
  older than 14 days — with no second notion of a day to reconcile. The cost is
  that a status changed yesterday evening reads as under a day old this morning;
  that is paid in wording ("Today", not "0 days"), not in the arithmetic.

  The instant is a prop, required with no default at every level down to the
  card, because `ApplicationCard` is in the client bundle and renders twice —
  once on the server for the HTML, once on hydration. A card reaching for its own
  clock would produce two different numbers and mismatch; a `now = new Date()`
  default would have type-checked, kept every existing test green, and hidden
  exactly that. Making it required turned all 21 missed call sites into compile
  errors instead.

  `daysInStatus` and `describeDaysInStatus` live in `lib/applications/status-age.ts`
  as pure functions of their arguments, so MVP item 6 thresholds the same number
  rather than re-deriving it.

- **2026-10-02 — the optimistic move resets the badge as well as the column.**
  `applyChange`'s `move` branch stamps the served instant onto `statusChangedAt`
  alongside `status`. This is not a guess about the server: `planStatusChange`
  provably resets that field on any real status change, so a card showing its old
  count in a new column would be stating the one thing the board knows to be
  wrong. A failed move needs no handling of its own — the optimistic change is
  dropped and the server list, carrying the original moment, wins, which is the
  same mechanism that already returns the card to its column.

- **2026-10-02 — a colour that clears AA on white can fail on a tinted
  background.** The day badge took `text-slate-500` from `BoardColumn`'s count,
  where it sits on `bg-white` and clears the 4.5:1 minimum at 4.76:1. On the
  badge's `bg-slate-100` the same colour is 4.34:1, which fails for 12px text;
  it is now `text-slate-600` at 6.92:1. Found by the 2026-10-02 review pass
  (`R20261002-3`) and recomputed before changing anything. Recorded here rather
  than left as a code comment because MVP item 6 is a *visual* flag for stale
  applications: whoever writes it will pick a colour, probably on a tint, and
  copying a pair that passes elsewhere is exactly how this one broke. Compute the
  ratio against the background it will actually sit on — and leave margin,
  because Tailwind 4 defines these as oklch and the sRGB hexes those numbers come
  from are close but not identical.

- **2026-10-02 — the stale threshold is inclusive at 14 whole days (MVP item
  6).** This file words item 6 twice — "more than 14 days in APPLIED" and
  "`statusChangedAt` older than 14 days" — and those readings differ by a day.
  The rule implemented is `status === APPLIED && daysInStatus(...) >= 14`, and
  the deciding argument is the display rather than the English: the card already
  shows "14d", so not flagging it while a card reading "15d" is flagged would
  look arbitrary with nothing on the card to explain the difference. It also
  matches what the floored count means, since `daysInStatus` returning 14 covers
  everything from exactly 14 days to just under 15 — "older than 14 days" for
  all but the single instant at exactly 14. Recorded because the next person to
  read "more than 14 days" reaches the same fork.

  Both halves of the rule are required, and the status half is the one most
  easily lost: an application sitting in Wishlist for months is a bookmark, not a
  stalled application, and one in Rejected is finished. The seeded e2e board
  carries a 263-day Wishlist card precisely so that case is exercised rather than
  assumed.

- **2026-10-02 — the stale flag is carried by text, not by colour.** Colour as
  the only carrier of meaning fails WCAG 1.4.1: a reader who cannot distinguish
  amber from slate would have no way to tell a flagged card from an unflagged
  one. So the flag is a pill reading "No movement", and the tint reinforces the
  word rather than replacing it. A ring around the card was considered and left
  out for the same reason — it is pure colour, so it would add nothing a
  colour-blind reader could use.

  The colour pair was computed against the tint it sits on, as the earlier entry
  in this log asks: `amber-800` on `amber-100` is 6.37:1. `amber-700` was the
  first choice at 4.51:1 — over the 4.5:1 minimum for 12px text by 0.01, which is
  no margin at all for Tailwind 4's oklch values not being the sRGB hexes the
  ratio is computed from. `amber-600`, the obvious warning colour, is 2.86:1 and
  fails outright. The lesson is that "it is a warning, so use the warning colour"
  does not survive contact with a tinted background.

- **2026-10-02 — a link must be an address, and 2048 became 512.** A manual pass
  found `https://test` stored as a job posting link. The check behind the field
  was `new URL()` plus a protocol test, and that pair only asks whether a value
  is syntactically a URL - any non-empty host satisfies it, so `http://a`,
  `https://.com` and `https://-.com` passed too, and the card rendered them as
  working links. The host must now be a domain: labels separated by dots, none
  empty and none starting or ending with a hyphen, under a top-level name of at
  least two characters. `localhost` and numeric hosts fall to that same rule and
  are deliberately not exempted - a job posting is not served by the machine
  running the tracker. A link carrying credentials (`https://user:pass@host`) is
  refused separately, because its host is a real domain and the card presents a
  stored link as something to open.

  Two decisions inside that rule are worth recording. An underscore is allowed
  in a label: the DNS hostname grammar has no place for it, but `URL` keeps it
  and `careers_eu.example.com` is a real shape, so refusing it would reject an
  address that resolves. The price is that `_.com` passes - an unregistrable
  name, so a dead link rather than a misleading one. And the two-character
  minimum for a top-level name applies only to Latin script: `a.b` is refused,
  `прикла.д` is accepted. A first attempt closed that gap by the length of the
  punycode form - a one-character name encodes to three characters after `xn--`,
  real names to four or more - and an independent review showed the measurement
  was wrong: it holds only for low code points, so `가`, `컴` and `한` encode to four
  and the rule would have refused `example.д` while accepting `example.컴`. The
  exact answer needs a punycode decode, which was prototyped and declined: the
  root zone has no one-character name in any script, so nothing anyone can paste
  reaches this case, and fifteen lines of punycode arithmetic in a module the
  client bundle imports is not worth a hand-typed dead link. The gap is recorded
  in the capability spec instead of being papered over.

  The lesson is about the measurement, not the rule: six one-character samples
  all came from ranges that fit the conclusion, and a sweep of the whole range
  would have shown 105,651 counter-examples. A boundary read off a sample is a
  guess with a table next to it.

  The maximum dropped from 2048 to 512. The 2026-09-29 entry above took 2048 as
  the conventional ceiling for a URL, which it is - but it is not a measurement
  of anything this tracker stores. Measured against real postings, the longest
  realistic address is around 130 characters (a LinkedIn link copied out of the
  address bar, with `refId` and `trackingId`); a clean posting path is 45 to 115.
  512 leaves room for a longer tracking tail at a quarter of the old ceiling.
  The limit matters more for this field than for the others: a company name cut
  short is visibly wrong, while a link cut short stores a dead address that looks
  whole.

  Not changed, deliberately: the field still stops accepting input silently at
  the maximum, with no counter and no message, and nothing prepends `https://`
  to a scheme-less value. The normal path is a paste of a complete address;
  prepending would need normalisation on two levels and would make the maximum
  measure a value the person never typed. What did change is the refusal message,
  which now names the shape of a web address with an example rather than only
  calling the value invalid - the one fault reached by hand is a bare domain, and
  "invalid" does not say what is missing.

- **2026-10-02 — "% that reached interview" counts a *current* status of Interview
  or Offer, measured against every tracked application (MVP item 7).** Both halves
  were forks with no answer in the code, so they are recorded here rather than left
  to be re-derived. The data model stores one status per application and the moment
  it was last set, with no log of the transitions it passed through, so a Rejected
  application cannot be known to have been interviewed before the rejection.
  Counting Rejected as reached was the alternative and was rejected: it treats every
  rejection as post-interview, so a board of applications silently rejected at the
  Applied stage would report a high interview rate — an error in the flattering
  direction, on the one figure whose job is to say whether the search is working.
  The cost is a known undercount in the other direction, which is why the region
  names what it counts on screen instead of leaving the number to be interpreted. A
  transition log in `prisma/schema.prisma` is the only way to make the figure exact
  and is its own change, with its own entry here.

  The denominator is the total shown beside it, Wishlist included. A truer
  conversion rate would exclude Wishlist — a bookmark is not an application that
  was sent, which is the argument MVP item 6 uses to refuse to flag an old Wishlist
  card — but the two figures share one line, and a percentage taken against a
  different set than the number next to it cannot be checked by eye and needs a
  third label to explain itself. One set, two figures.

  The share is a whole number, clamped away from both ends: 0% only when none
  reached interview, 100% only when all did. Ordinary rounding crosses both
  boundaries with plausible numbers — 1 of 201 rounds to 0%, 200 of 201 to 100% —
  and each of those reports the opposite of the thing the person is looking for.
  The accepted cost is that 1 of 201 and 2 of 201 both read 1%.

  No data-model change, so no `npx prisma db push`: both figures are derived from
  rows the board already reads.

- **2026-10-02 — layout guarantees are measured in a browser, never in jsdom.**
  The first plan for MVP item 7 assigned "a large total does not distort the board"
  to a component test asserting that the region "does not overflow" and "wraps".
  Vitest runs `environment: "node"` with jsdom opted in per file, and jsdom has no
  layout engine: every element measures zero, so the only way to write that test is
  an assertion on a class substring — which `measure-long-value-layout` already
  deleted from this project as a test that "could not fail for any reason the spec
  cares about". The proposal review caught it before any code was written, and also
  showed the excuse behind it to be false: `e2e/long-value-layout.spec.ts` inserts
  rows straight into `e2e.db` with better-sqlite3, and `resetBoard` restores the
  snapshot in one transaction, so a four-digit total is a thousand rows in one
  commit. It is now measured there, in a real browser, at both viewports.

- **2026-10-03 — moving a card gains a third activator, and touch drag is
  knowingly left broken (MVP item 3).** On a touch device there was no way to
  change a status. The pointer drag dies the moment the finger moves: nothing sets
  `touch-action: none`, so the browser claims the gesture for scrolling and the
  `pointercancel` that follows cancels the drag. The keyboard path works but a
  phone has no arrow keys, and the edit form omits `status` on purpose. Item 3 says
  "drag a card between columns"; a card can now also be moved by tapping its
  handle and choosing a column from a dialog.

  This refines the 2026-09-29 and 2026-10-01 entries; it does not reverse them.
  Those say status has no picker and is owned by the drag-and-drop path, because a
  form that set status alongside the other fields would give `status`,
  `appliedDate` and `statusChangedAt` a second owner with a second set of rules.
  The chooser is not that: it goes through the same `planCardMove` and `moveCard`
  a drop does, so the three fields keep one owner and one set of rules. What is
  added is a second *activator* of the same move, and every guarantee a move has
  already — stored, counted, held while writing, rolled back on failure, badge and
  flag recalculated — applies to it without being written again.

  Touch drag is left broken deliberately, not overlooked. On a phone the board is a
  single column, so five columns stack and a Wishlist-to-Offer drag needs about
  2000px of autoscroll with a finger held down; a drag that technically works and
  cannot be used is worth less than the chooser. Making it work would also cost the
  page its own vertical scroll wherever a finger lands on a handle. Non-goals say
  mobile "just needs to work reasonably well" — which permits leaving a gesture
  out, and does not permit leaving the status unreachable. That is what this fixes.

  The chooser is offered on every device, not swapped in for touch. Deciding from
  `matchMedia('(pointer: coarse)')` needs `window`, so the server and the first
  client render would differ — the failure the required `now` prop and the fixed
  `DndContext` id exist to prevent — and it reports wrongly on a touchscreen laptop
  or a tablet with a trackpad. It is also the way a trackpad or screen-reader user
  reaches a card without holding a drag.

  It is not opened from the keyboard. Space and Enter on the handle already start a
  keyboard move, and dnd-kit calls `preventDefault()` on them, so the two cannot
  collide; freeing a key for the chooser would mean replacing dnd-kit's key table,
  which the arrow-key path runs on. A keyboard user can already reach every column.

  No data-model change, so no `npx prisma db push`.
