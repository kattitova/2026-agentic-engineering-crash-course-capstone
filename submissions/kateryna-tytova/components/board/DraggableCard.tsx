"use client";

import { useDraggable } from "@dnd-kit/core";
import type { JobApplication } from "@/app/generated/prisma/client";
import { ApplicationCard } from "./ApplicationCard";

interface DraggableCardProps {
  application: JobApplication;
  isMovePending: boolean;
}

/**
 * Holds the useDraggable wiring so ApplicationCard does not have to.
 *
 * Keeping the hook out of the card is what lets the card render — and be
 * tested — without a DndContext above it, which is the presentational split the
 * design asks for.
 */
export function DraggableCard({ application, isMovePending }: DraggableCardProps) {
  const { setNodeRef, attributes, listeners, transform, isDragging } = useDraggable({
    id: application.id,
    // A card whose write has not settled must not start another move.
    disabled: isMovePending,
    data: { status: application.status },
  });

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
        isMovePending={isMovePending}
        dragHandle={{ attributes, listeners }}
      />
    </div>
  );
}
