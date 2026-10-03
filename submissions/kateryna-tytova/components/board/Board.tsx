"use client";

import {
  DndContext,
  KeyboardSensor,
  MeasuringStrategy,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type KeyboardCoordinateGetter,
} from "@dnd-kit/core";
import { useCallback, useState } from "react";
import { ApplicationDialog } from "@/components/application-form/ApplicationDialog";
import { ConfirmDeleteDialog } from "@/components/application-form/ConfirmDeleteDialog";
import type { JobApplication } from "@/app/generated/prisma/client";
import type { ApplicationStatus } from "@/app/generated/prisma/enums";
import { BOARD_COLUMNS, groupApplicationsByStatus } from "@/lib/applications/board";
import {
  columnAtPoint,
  keyboardStep,
  planCardMove,
  type ColumnRect,
} from "@/lib/applications/move";
import { isApplicationStatus } from "@/lib/applications/status";
import { summariseBoard } from "@/lib/applications/stats";
import { BoardColumn } from "./BoardColumn";
import { BoardStats } from "./BoardStats";
import { MoveCardDialog } from "./MoveCardDialog";
import { useBoardCards } from "./useBoardCards";

/**
 * Moves a picked-up card to the adjacent column instead of dnd-kit's default
 * 25px nudge, which is a fraction of a column and never reaches the next one.
 *
 * Only measurement and event decoding live here; which column is next, and
 * where it is, are decided by pure functions in lib/applications/move.ts, so
 * the wrapped-grid case is covered by unit tests rather than by a browser.
 *
 * Up/Down return undefined — dnd-kit reads that as "no movement" — because
 * position within a column carries no meaning in the data model.
 */
const columnCoordinateGetter: KeyboardCoordinateGetter = (
  event,
  { context: { active, droppableRects, droppableContainers, collisionRect } },
) => {
  const direction = event.code === "ArrowRight" ? 1 : event.code === "ArrowLeft" ? -1 : 0;
  if (direction === 0 || !collisionRect || !active) {
    return undefined;
  }

  const columns: ColumnRect[] = [];
  for (const container of droppableContainers.getEnabled()) {
    const rect = droppableRects.get(container.id);
    if (rect && isApplicationStatus(container.id)) {
      columns.push({
        status: container.id,
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
      });
    }
  }

  // Where the card is now, by the centre of its own rect so a wrapped grid
  // cannot confuse two columns that share a left edge. Falls back to the column
  // it was picked up from, which is the only answer before the first key press.
  const centre = {
    x: collisionRect.left + collisionRect.width / 2,
    y: collisionRect.top + collisionRect.height / 2,
  };
  const currentStatus =
    columnAtPoint(columns, centre) ?? active.data.current?.["status"];
  if (!isApplicationStatus(currentStatus)) {
    return undefined;
  }

  return keyboardStep(columns, currentStatus, direction) ?? undefined;
};

/**
 * `now` is the instant the page was served, and it is required at every level
 * down to the card. Defaulting it would type-check, keep every existing test
 * green, and put a clock back inside a component that renders twice - which is
 * the single failure the day-count design exists to prevent.
 */
export function Board({
  applications,
  now,
}: {
  applications: JobApplication[];
  now: Date;
}) {
  const { shown, isCardBusy, error, moveCard, removeCard } = useBoardCards(applications, now);
  // Set for a keyboard move and for a move from the chooser, not for a pointer
  // drag: after a drag the person's attention is already where they dropped the
  // card, and focusing would show a ring they did not ask for. The other two have
  // no such place - the key press or the dialog they chose from is gone.
  const [focusCardId, setFocusCardId] = useState<string | null>(null);
  const clearFocusTarget = useCallback(() => setFocusCardId(null), []);

  // The applications themselves, not their ids looked up in `shown`.
  //
  // Looking them up tied each dialog's open state to the row still being there,
  // and the not-found branch of both actions revalidates the board - so the row
  // left the list in the same breath as the result arrived, the dialog closed
  // and the form was unmounted with its "Application not found" message still
  // in it. The person saw a dialog close and a card vanish, which is what a
  // save that worked looks like.
  //
  // Nothing is lost by holding the object: the form is keyed by the application
  // and seeds its fields once per mount, so it never re-read the looked-up row
  // anyway. A dialog now closes when the person closes it, which is the only
  // thing that should close it.
  const [editing, setEditing] = useState<JobApplication | null>(null);
  const [deleting, setDeleting] = useState<JobApplication | null>(null);
  // The same reason again, and the one most exposed to it: a chooser move rewrites
  // `shown` the instant a column is picked, so an id looked up there would find
  // the card already in its new column.
  const [moving, setMoving] = useState<JobApplication | null>(null);

  const openEdit = useCallback((application: JobApplication) => setEditing(application), []);
  const closeEdit = useCallback(() => setEditing(null), []);
  const openDelete = useCallback((application: JobApplication) => setDeleting(application), []);
  const closeDelete = useCallback(() => setDeleting(null), []);
  const openMove = useCallback((application: JobApplication) => setMoving(application), []);
  const closeMove = useCallback(() => setMoving(null), []);

  // Closed before the write is started, not after: the optimistic removal takes
  // the card off the board immediately, and a confirmation still naming it would
  // then be asking about something the person can no longer see. The failure
  // message goes to the board's own region for exactly that reason.
  const confirmDelete = useCallback(
    (application: JobApplication) => {
      setDeleting(null);
      removeCard(application.id);
    },
    [removeCard],
  );

  // Through planCardMove and moveCard, the path a drop takes, and not straight to
  // the server action. That is what gives a chooser move the optimistic placement,
  // the hold while it writes, the rollback and the failure message without any of
  // them being written a second time. A handler that skipped it would still call
  // the action once with the right status, which is all a component test of this
  // can see - e2e/move-by-menu.spec.ts is what fails if it does.
  //
  // Closed before the write starts, for the reason confirmDelete gives.
  const chooseMove = useCallback(
    (application: JobApplication, to: ApplicationStatus) => {
      setMoving(null);
      const move = planCardMove(application.id, application.status, to);
      if (move !== null) {
        setFocusCardId(move.cardId);
        moveCard(move);
      }
    },
    [moveCard],
  );

  const sensors = useSensors(
    // The distance is what lets the drag handle also be clicked. Without one the
    // sensor starts a drag on pointerdown, and starting a drag installs a
    // document-level handler that stops the click that follows - so the handle's
    // own onClick, which opens the chooser, could never fire. With one, a press
    // that stays within 5px is never a drag, its click goes through, and one that
    // travels further is a drag exactly as before. 5px is above what a click
    // drifts by and far below the distance to the next column.
    //
    // KeyboardSensor takes no such constraint, so the keyboard path is unchanged.
    // Held by "Board telling a click from a drag", which fails with this removed.
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    // Registering the sensor is not enough; the coordinate getter is what makes
    // one key press cross a column.
    useSensor(KeyboardSensor, { coordinateGetter: columnCoordinateGetter }),
  );

  function handleDragEnd({ active, over, activatorEvent }: DragEndEvent) {
    const from = active.data.current?.["status"];
    if (!isApplicationStatus(from)) {
      return;
    }

    const move = planCardMove(String(active.id), from, over?.id);
    if (move !== null) {
      setFocusCardId(
        activatorEvent instanceof KeyboardEvent ? move.cardId : null,
      );
      moveCard(move);
    }
  }

  const grouped = groupApplicationsByStatus(shown);

  return (
    // A stable id, or dnd-kit derives its aria-describedby from a module-level
    // counter that starts over on the client and the tree fails to hydrate.
    <DndContext
      id="board"
      sensors={sensors}
      onDragEnd={handleDragEnd}
      // Measure the columns up front. The default measures them after a drag
      // starts, so an arrow key pressed in the same breath as the pick-up finds
      // no rectangles, the coordinate getter has nothing to aim at and the key
      // press is silently swallowed. Reproduced as a 3-in-15 e2e flake.
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
    >
      {/* Summarised from `grouped`, which comes from `shown` - the optimistic
          list - and not from the server list in app/page.tsx. That is the whole
          reason this sits in the client tree: a card dropped into Interview under
          a percentage that had not moved yet would have the page contradicting
          itself on screen, which is the same trade the day badge already refused.
          `grouped` is also what makes the total equal the number of cards, since
          it is the cards. */}
      <BoardStats summary={summariseBoard(grouped)} />

      {/* Assertive: a move that did not happen has to interrupt, because the card
          moving back is easy to miss. Always rendered so the region exists before
          the message does. */}
      <p
        role="alert"
        aria-live="assertive"
        className={
          error === null
            ? "sr-only"
            : "mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
        }
      >
        {error ?? ""}
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {BOARD_COLUMNS.map((column) => (
          <BoardColumn
            key={column.status}
            column={column}
            applications={grouped[column.status]}
            isCardBusy={isCardBusy}
            focusCardId={focusCardId}
            onFocusRestored={clearFocusTarget}
            onEdit={openEdit}
            onDelete={openDelete}
            onMove={openMove}
            now={now}
            draggable
          />
        ))}
      </div>

      {/* One of each for the whole board, rather than a pair per card: a dialog
          inside a card would have to restore focus from a control that is about
          to be unmounted, which is exactly what a deleted card does. */}
      <ApplicationDialog open={editing !== null} application={editing} onClose={closeEdit} />
      {/* No pending state to pass: the confirmation closes before the write
          starts, so one confirmation cannot become two writes because the
          control is gone, not because it is disabled. */}
      <ConfirmDeleteDialog
        application={deleting}
        onConfirm={confirmDelete}
        onCancel={closeDelete}
      />
      {/* Dismissing it sets no focus target: nothing unmounts, so the browser's own
          restoration returns focus to the handle the card focused before opening. */}
      <MoveCardDialog application={moving} onChoose={chooseMove} onCancel={closeMove} />
    </DndContext>
  );
}
