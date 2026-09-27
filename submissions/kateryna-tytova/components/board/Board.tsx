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
import type { JobApplication } from "@/app/generated/prisma/client";
import { BOARD_COLUMNS, groupApplicationsByStatus } from "@/lib/applications/board";
import {
  columnAtPoint,
  keyboardStep,
  planCardMove,
  type ColumnRect,
} from "@/lib/applications/move";
import { isApplicationStatus } from "@/lib/applications/status";
import { BoardColumn } from "./BoardColumn";
import { useCardMoves } from "./useCardMoves";

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

export function Board({ applications }: { applications: JobApplication[] }) {
  const { shown, isMovePending, error, moveCard } = useCardMoves(applications);
  // Only set for a keyboard move: after a pointer drag the person's attention is
  // already where they dropped the card, and focusing would show a ring they
  // did not ask for.
  const [focusCardId, setFocusCardId] = useState<string | null>(null);
  const clearFocusTarget = useCallback(() => setFocusCardId(null), []);

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
            isMovePending={isMovePending}
            focusCardId={focusCardId}
            onFocusRestored={clearFocusTarget}
            draggable
          />
        ))}
      </div>
    </DndContext>
  );
}
