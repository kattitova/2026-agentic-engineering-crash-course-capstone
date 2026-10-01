"use client";

import { useCallback, useOptimistic, useState, useTransition } from "react";
import { updateApplicationStatus } from "@/app/actions/applications";
import type { JobApplication } from "@/app/generated/prisma/client";
import type { CardMove } from "@/lib/applications/move";

export interface CardMoves {
  /** The board as the person should see it right now, optimistic move included. */
  shown: JobApplication[];
  /** True while that one card's write is outstanding. */
  isMovePending: (cardId: string) => boolean;
  error: string | null;
  moveCard: (move: CardMove) => void;
}

function applyMove(applications: JobApplication[], move: CardMove): JobApplication[] {
  return applications.map((application) =>
    application.id === move.cardId ? { ...application, status: move.to } : application,
  );
}

/**
 * Coordinates a card move: optimistic placement, the write, which cards are
 * held while writing, and the failure message.
 *
 * Separate from Board because dnd-kit cannot be driven in jsdom — it needs real
 * layout — so none of this would be testable if it lived in the component. Here
 * it is reachable with the action mocked.
 */
export function useCardMoves(applications: JobApplication[]): CardMoves {
  // Derived from the server list each render, so once revalidation lands the
  // stored data wins by construction rather than by manual reconciliation.
  const [shown, addOptimisticMove] = useOptimistic(applications, applyMove);
  // A set, not one id: two cards can be writing at once, and releasing the
  // first because a second started is exactly the ordering the spec forbids.
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const moveCard = useCallback((move: CardMove) => {
    setError(null);
    setPending((current) => new Set(current).add(move.cardId));

    startTransition(async () => {
      addOptimisticMove(move);
      try {
        const result = await updateApplicationStatus(move.cardId, move.to);
        if (!result.ok) {
          setError(result.error);
        }
      } catch (error) {
        // The action is typed never to reject, and since this change it does
        // not. This is here because the cost of being wrong about that is the
        // whole board: an unhandled rejection in a transition reaches the
        // nearest error boundary, which replaces the page. The text is a copy
        // of the action's rather than an import, because a "use server" file
        // can only export async functions.
        console.error(error);
        setError("The move was not saved. Please try again.");
      } finally {
        // Release only this card, and whatever happened. Another card's write
        // may still be outstanding, and a release that sits after the await is
        // one a failure never reaches - which left the card held for good.
        setPending((current) => {
          const next = new Set(current);
          next.delete(move.cardId);
          return next;
        });
      }
    });
  }, [addOptimisticMove]);

  const isMovePending = useCallback((cardId: string) => pending.has(cardId), [pending]);

  return { shown, isMovePending, error, moveCard };
}
