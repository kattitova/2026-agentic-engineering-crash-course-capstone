"use client";

import { useDraggable } from "@dnd-kit/core";
import { useEffect, useRef } from "react";
import type { JobApplication } from "@/app/generated/prisma/client";
import { ApplicationCard } from "./ApplicationCard";

interface DraggableCardProps {
  application: JobApplication;
  isCardBusy: boolean;
  /** True for the card a keyboard move just landed on. */
  shouldRestoreFocus?: boolean;
  onFocusRestored?: () => void;
  onEdit?: (application: JobApplication) => void;
  onDelete?: (application: JobApplication) => void;
  onMove?: (application: JobApplication) => void;
  now: Date;
}

/**
 * Holds the useDraggable wiring so ApplicationCard does not have to.
 *
 * Keeping the hook out of the card is what lets the card render — and be
 * tested — without a DndContext above it, which is the presentational split the
 * design asks for.
 */
export function DraggableCard({
  application,
  isCardBusy,
  shouldRestoreFocus = false,
  onFocusRestored,
  onEdit,
  onDelete,
  onMove,
  now,
}: DraggableCardProps) {
  const handleRef = useRef<HTMLButtonElement>(null);
  const { setNodeRef, attributes, listeners, transform, isDragging } = useDraggable({
    id: application.id,
    // A card whose write has not settled must not start another move.
    disabled: isCardBusy,
    data: { status: application.status },
  });

  // A completed move disables the handle and then remounts the card under a
  // different column, so the keyboard user is left on the document body with no
  // way back except tabbing from the top of the page.
  useEffect(() => {
    if (shouldRestoreFocus && !isCardBusy) {
      handleRef.current?.focus();
      onFocusRestored?.();
    }
  }, [shouldRestoreFocus, isCardBusy, onFocusRestored]);

  return (
    <div
      ref={setNodeRef}
      style={
        transform
          ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
          : undefined
      }
      className={isDragging ? "relative z-10 opacity-80" : undefined}
    >
      <ApplicationCard
        application={application}
        isCardBusy={isCardBusy}
        onEdit={onEdit}
        onDelete={onDelete}
        onMove={onMove}
        now={now}
        dragHandle={{ attributes, listeners, ref: handleRef }}
      />
    </div>
  );
}
