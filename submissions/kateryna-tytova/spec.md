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
| company     | string                                                      | required                                 |
| position    | string                                                      | required                                 |
| status      | enum: WISHLIST \| APPLIED \| INTERVIEW \| OFFER \| REJECTED | defaults to WISHLIST                     |
| link        | string?                                                     | link to the job posting                  |
| notes       | string?                                                     | free text                                |
| appliedDate | DateTime?                                                   | set on the first transition into APPLIED |
| createdAt   | DateTime                                                    | auto                                     |
| updatedAt   | DateTime                                                    | auto                                     |

## MVP scope (in)

1. Kanban board with columns per status.
2. Add a new application (form: company, position, link, notes).
3. Drag a card between columns → updates status (and `appliedDate`, if this
   is the first transition into APPLIED).
4. Edit and delete an application.
5. A badge showing "N days in this status" on each card.
6. Visual flag for "stale" applications (more than 14 days in APPLIED with
   no movement).
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
