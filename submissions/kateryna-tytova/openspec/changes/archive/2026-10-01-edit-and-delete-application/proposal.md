# Proposal

## Why

An application can be added and moved between columns, but once it is on the board nothing about it
can be corrected or taken off: a typo in the company name, a posting link that turned out wrong, or
a card created by mistake is permanent unless the database is edited by hand — which is the thing
this tracker exists to avoid. MVP item 4 of `spec.md` ("Edit and delete an application") is the last
write operation missing from the board.

Most of the write side already exists: `updateApplication` and `deleteApplication` in
`app/actions/applications.ts` validate, report failures as `ActionResult`, distinguish a missing row
from an unclassifiable failure, and are covered by `app/actions/applications.test.ts`. What is
missing is the way a person reaches them — and one gap in those two actions: unlike
`updateApplicationStatus`, neither revalidates the board when the row turns out to be gone, so a
card for a deleted application would sit on the board until a manual reload.

## What Changes

- Each card gains two entry points: one that opens the application for editing, one that deletes it.
- The add form becomes an application form that serves both purposes: opened for an existing
  application it starts pre-filled with the stored values, and submitting it saves the correction
  instead of creating a second card. Its fields, limits, refusal messages and keyboard behaviour are
  unchanged and are not duplicated for editing.
- Editing covers the four fields the form already collects — company, position, link, notes. It does
  **not** change status: status is owned by the drag-and-drop path, which also decides `appliedDate`
  and `statusChangedAt`. Editing an application therefore leaves its column and its "time in this
  status" clock alone.
- Deleting asks for confirmation first, because it is irreversible and there is no undo in the MVP.
  A confirmed deletion removes the card from the board without a reload.
- A failed edit or a failed deletion is reported where the person is looking, and the board is left
  showing what is actually stored — the same contract the failed-move path already keeps.
- An application that no longer exists (deleted in another tab, or in the database) is reported as
  gone rather than as an unexplained failure, and its card is not restored.

## Capabilities

### New Capabilities

- `application-delete`: removing an application from the board — the confirmation step, what a
  confirmed deletion does to the board, and how a refused or failed deletion leaves it.

### Modified Capabilities

- `application-form`: the form currently specifies adding only. Its requirements on field set,
  refusal behaviour, length maximums, failure reporting and keyboard operability are restated to
  cover both modes — modified in place rather than paired with edit-only twins, since those rules
  are identical and two copies would be free to drift. Behaviour that exists only when editing is
  added separately: opening the form on an existing application, a saved edit updating the board in
  place, an edit leaving status and the status clock alone, and an edit of an application that no
  longer exists.
- `kanban-board`: a card currently specifies the company, the role and the posting link. It gains a
  requirement that a card offers controls for editing and deleting its own application, named so
  that a board of several cards does not present a list of identical controls.

## Impact

- `components/board/ApplicationCard.tsx` — the two per-card controls, alongside the existing drag
  handle and posting link.
- `components/application-form/` — the form generalised from add-only to add-or-edit; a dialog that
  can be opened for an existing application; a confirmation step for deletion.
- `components/board/Board.tsx` and `BoardColumn.tsx` — passing the per-card callbacks down, and
  reporting edit and delete failures through the alert region the board already has.
- `app/actions/applications.ts` — a `useActionState` wrapper over `updateApplication`, mirroring
  `createApplicationFromForm`; and `revalidatePath` added to the not-found branch of both
  `updateApplication` and `deleteApplication`, which is what lets a card for a row that no longer
  exists leave the board without a reload. Their validation and failure classification are
  otherwise unchanged.
- `components/board/useCardMoves.ts` and `components/board/DraggableCard.tsx` — the move hook
  generalised to carry deletions over one optimistic list, and the per-card callbacks threaded
  through the draggable wrapper. The hook and its file are renamed accordingly.
- No change to `prisma/schema.prisma`, no new dependency.
- `spec.md` — a change-log entry recording that editing deliberately leaves status, `appliedDate`
  and `statusChangedAt` untouched.
