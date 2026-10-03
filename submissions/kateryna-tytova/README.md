# Job Application Tracker

A small personal Kanban board for tracking job applications: which stage each
one is at, how long it has been there, which ones have gone quiet, and how the
search is going overall. Built as the capstone for the fwdays
*Crash Course: Agentic Engineering*, with Claude Code doing the implementation
under a written spec, project rules and independent review agents.

What it does is defined in [`spec.md`](spec.md): the seven MVP items, what is
deliberately out of scope, the Definition of Done, and a change log of every
place where the build diverged from the plan and why.

## Features

- Kanban board with five columns: Wishlist, Applied, Interview, Offer, Rejected.
- Add, edit and delete an application (company, position, link, notes), with
  validation and length limits shared by every write path.
- Move a card by dragging it, with the keyboard, or by tapping its handle and
  choosing a column (the way to move a card on a phone).
- "N days in this status" on every card.
- A "No movement" flag on applications that have been in Applied for 14 days or more.
- Summary above the board: total applications and the share that reached interview.

## Stack

Next.js 16 (App Router) · TypeScript (strict) · Prisma 7 + SQLite ·
Server Actions · `@dnd-kit` · Tailwind CSS 4 · Vitest · Playwright.
No external services: the database is a local file.

## Run it

Requires Node 20.9+ and npm (the OpenSpec CLI needs Node 22).

```bash
npm install
npx prisma db push      # creates dev.db from prisma/schema.prisma
npm run db:seed         # optional: four sample applications (skipped if dev.db has data)
npm run dev             # http://localhost:3000
```

### Demo board

A fuller board for the demo, with a card for every feature: stale and fresh
Applied cards, the 14-day boundary, an old Wishlist bookmark that is not flagged,
interviews, an offer and rejections. It lives in its own `demo.db`, so `dev.db`
is never touched.

```bash
npm run demo:db         # (re)creates demo.db, dated relative to today
npm run demo            # next dev against demo.db
```

Seed right before recording: the day counts are relative to the moment of
seeding. To open the demo from a phone on the same network, run
`npm run demo -- -H 0.0.0.0` and add the computer's IP address to
`allowedDevOrigins` in `next.config.ts`. Next 16 blocks dev assets for any
other origin, and the page then loads without JavaScript.

## Verify

```bash
npm run verify          # lint + typecheck + unit tests
npm run test:e2e        # Playwright, against a disposable e2e.db
```

## How it was built

| Where | What it shows |
| --- | --- |
| [`spec.md`](spec.md) | The spec, committed before any code, and its change log |
| [`AGENTS.md`](AGENTS.md) | Project rules for the agent: stack, npm only, TDD, review gates, commit format |
| [`openspec/`](openspec/) | Each feature as an OpenSpec change (proposal, design, tasks, delta specs), archived after review |
| [`.claude/agents/`](.claude/agents/) | `proposal-reviewer` and `reviewer`: independent review agents with their own restricted settings |
| [`.claude/hooks/`](.claude/hooks/) | Hooks that protect `.env`, log every agent action and launch reviews |
| [`docs/reviews/`](docs/reviews/), [`docs/review-log.md`](docs/review-log.md) | Every code review, its verdict and findings |
| [`docs/reviews/decisions.md`](docs/reviews/decisions.md) | What the author did with each finding: fixed, accepted, deferred or declined |
| [`docs/proposal-reviews/`](docs/proposal-reviews/) | Reviews of plans before implementation |
| [`docs/agent-log.md`](docs/agent-log.md) | Per-session reports of what the agent ran, and what was blocked |
