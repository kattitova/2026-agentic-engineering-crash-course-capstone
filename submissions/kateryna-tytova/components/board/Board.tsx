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
  // Only set for a keyboard move: after a pointer drag the person's attention is
  // already where they dropped the card, and focusing would show a ring they
  // did not ask for.
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

  const openEdit = useCallback((application: JobApplication) => setEditing(application), []);
  const closeEdit = useCallback(() => setEditing(null), []);
  const openDelete = useCallback((application: JobApplication) => setDeleting(application), []);
  const closeDelete = useCallback(() => setDeleting(null), []);

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

  const sensors = useSensors(
    useSensor(PointerSensor),
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
    </DndContext>
  );
}
