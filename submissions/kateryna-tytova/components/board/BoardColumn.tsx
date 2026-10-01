"use client";

import { useDroppable } from "@dnd-kit/core";
import type { JobApplication } from "@/app/generated/prisma/client";
import type { BoardColumn as BoardColumnDefinition } from "@/lib/applications/board";
import { ApplicationCard } from "./ApplicationCard";
import { DraggableCard } from "./DraggableCard";

interface BoardColumnProps {
  column: BoardColumnDefinition;
  applications: JobApplication[];
  /** Absent when the column is rendered outside a DndContext, as in its tests. */
  isMovePending?: (cardId: string) => boolean;
  focusCardId?: string | null;
  onFocusRestored?: () => void;
  onEdit?: (application: JobApplication) => void;
  onDelete?: (application: JobApplication) => void;
  draggable?: boolean;
}

export function BoardColumn({
  column,
  applications,
  isMovePending = () => false,
  focusCardId = null,
  onFocusRestored,
  onEdit,
  onDelete,
  draggable = false,
}: BoardColumnProps) {
  const headingId = `column-${column.status}-heading`;
  const count = applications.length;
  // The droppable id is the status itself, so the drop target needs no lookup
  // table and planCardMove can validate it like any other untrusted value.
  const { setNodeRef, isOver } = useDroppable({ id: column.status, disabled: !draggable });

  return (
    // Named region, so the columns become landmarks a keyboard user can jump between.
    <section
      ref={draggable ? setNodeRef : undefined}
      aria-labelledby={headingId}
      className={`flex flex-col gap-3 rounded-2xl border p-3 transition-colors ${
        isOver ? "border-indigo-400 bg-indigo-100/70" : "border-slate-200 bg-slate-200/55"
      }`}
    >
      <div className="flex items-center justify-between px-1">
        <h2
          id={headingId}
          className="flex items-center gap-2 text-sm font-semibold leading-5 text-slate-700"
        >
          <span className={`size-2.5 rounded-full ${column.dotClass}`} aria-hidden="true" />
          {column.label}
        </h2>
        <span className="rounded-full bg-white px-2 py-px text-xs font-medium text-slate-500 shadow-sm">
          {/* Real text rather than an aria-label: the badge is a bare <span>, whose
              `generic` role is name-prohibited in ARIA, so a label on it is not
              something a screen reader can be relied on to announce. */}
          <span aria-hidden="true">{count}</span>
          {/* One template literal, not `{count} {word}`: JSX would emit three text
              nodes and the accessibility tree would carry no "3 applications" name. */}
          <span className="sr-only">{`${count} ${count === 1 ? "application" : "applications"}`}</span>
        </span>
      </div>

      {applications.length === 0 ? (
        <p className="px-1 py-6 text-center text-xs text-slate-500">No applications yet</p>
      ) : (
        applications.map((application) =>
          draggable ? (
            <DraggableCard
              key={application.id}
              application={application}
              isMovePending={isMovePending(application.id)}
              shouldRestoreFocus={application.id === focusCardId}
              onFocusRestored={onFocusRestored}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ) : (
            <ApplicationCard
              key={application.id}
              application={application}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ),
        )
      )}
    </section>
  );
}
