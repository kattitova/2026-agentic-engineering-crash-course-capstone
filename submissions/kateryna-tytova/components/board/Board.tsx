"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type KeyboardCoordinateGetter,
} from "@dnd-kit/core";
import { useOptimistic, useState, useTransition } from "react";
import { updateApplicationStatus } from "@/app/actions/applications";
import type { JobApplication } from "@/app/generated/prisma/client";
import { BOARD_COLUMNS, groupApplicationsByStatus } from "@/lib/applications/board";
import {
  columnAtPoint,
  keyboardStep,
  planCardMove,
  type CardMove,
  type ColumnRect,
} from "@/lib/applications/move";
import { isApplicationStatus } from "@/lib/applications/status";
import { BoardColumn } from "./BoardColumn";

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

function applyMove(applications: JobApplication[], move: CardMove): JobApplication[] {
  return applications.map((application) =>
    application.id === move.cardId ? { ...application, status: move.to } : application,
  );
}

export function Board({ applications }: { applications: JobApplication[] }) {
  // Derived from the server list each render, so once revalidation lands the
  // stored data wins by construction rather than by manual reconciliation.
  const [shown, addOptimisticMove] = useOptimistic(applications, applyMove);
  const [pendingCardId, setPendingCardId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const sensors = useSensors(
    useSensor(PointerSensor),
    // Registering the sensor is not enough; the coordinate getter is what makes
    // one key press cross a column.
    useSensor(KeyboardSensor, { coordinateGetter: columnCoordinateGetter }),
  );

  function handleDragEnd({ active, over }: DragEndEvent) {
    const from = active.data.current?.["status"];
    if (!isApplicationStatus(from)) {
      return;
    }

    const move = planCardMove(String(active.id), from, over?.id);
    if (move === null) {
      return;
    }

    setError(null);
    setPendingCardId(move.cardId);
    startTransition(async () => {
      addOptimisticMove(move);
      const result = await updateApplicationStatus(move.cardId, move.to);
      if (!result.ok) {
        setError(result.error);
      }
      setPendingCardId(null);
    });
  }

  const grouped = groupApplicationsByStatus(shown);

  return (
    // A stable id, or dnd-kit derives its aria-describedby from a module-level
    // counter that starts over on the client and the tree fails to hydrate.
    <DndContext id="board" sensors={sensors} onDragEnd={handleDragEnd}>
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
            pendingCardId={pendingCardId}
            draggable
          />
        ))}
      </div>
    </DndContext>
  );
}
