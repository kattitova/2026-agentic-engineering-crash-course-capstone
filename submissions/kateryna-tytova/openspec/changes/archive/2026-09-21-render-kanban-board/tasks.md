# Tasks

## 1. Board data helpers in lib (TDD)

- [x] 1.1 Write `lib/applications/board.test.ts` covering column identity and grouping, and
      verify it fails with "cannot find module ./board" when `npm run verify` runs (red step
      required by the project's TDD rule)
- [x] 1.2 Implement `lib/applications/board.ts` with the ordered column table (status, label,
      colour token) typed exhaustively over `ApplicationStatus`, and verify the column tests
      pass
- [x] 1.3 Implement `groupApplicationsByStatus()` returning an entry for every status,
      including an empty array for statuses with no applications, and verify the grouping
      tests pass, including the empty-board case
- [x] 1.4 Run `npm run verify` and confirm lint, typecheck and all unit tests pass

## 2. Page shell and global styles

- [x] 2.1 Remove the `prefers-color-scheme: dark` block and the `body { font-family: Arial }`
      rule from `app/globals.css`, and verify the page ground stays light with the OS set to
      dark mode
- [x] 2.2 Update the metadata in `app/layout.tsx` to the product title and description, and
      verify the browser tab no longer reads "Create Next App"
- [x] 2.3 Replace `app/page.tsx` with a Server Component that awaits `listApplications()` and
      renders the header (title, subtitle, disabled "Add application" button), and verify the
      page renders without a `"use client"` directive anywhere in the new code

## 3. Board components

- [x] 3.1 Add `components/board/BoardColumn.tsx` rendering the column label, status colour
      dot, count badge and its cards, and verify all five columns appear against seeded data
- [x] 3.2 Add the empty-state message to `BoardColumn` for a column with no cards, and verify
      an empty column shows the message instead of a blank area
- [x] 3.3 Add `components/board/ApplicationCard.tsx` showing company and position, with the
      company visually dominant, and verify both values appear on each seeded card
- [x] 3.4 Render the job posting link on the card only when `link` is set, opening in a new tab
      with `rel="noopener noreferrer"`, and verify a card without a link shows no link control
- [x] 3.5 Add `components/board/Board.tsx` laying the five columns out in a responsive grid per
      the mockup, and verify the board matches the approved design at 1440px width

## 4. Verification

- [x] 4.1 Run `npm run db:seed` if the database is empty, start `npm run dev`, and verify every
      seeded application appears exactly once, in the column matching its status
- [x] 4.2 Delete all applications (or point `DATABASE_URL` at an empty database) and verify the
      board shows five empty columns with no error
- [x] 4.3 Run `npm run verify` and confirm it passes with no errors before marking the change
      complete
