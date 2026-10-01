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
| link        | string?                                                     | link to the job posting; http(s) only, at most 2048 characters |
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
