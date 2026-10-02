"use client";

import { useCallback, useOptimistic, useState, useTransition } from "react";
import { deleteApplication, updateApplicationStatus } from "@/app/actions/applications";
import type { JobApplication } from "@/app/generated/prisma/client";
import { FAILED, type ActionResult } from "@/lib/applications/action-result";
import type { CardMove } from "@/lib/applications/move";

export interface BoardCards {
  /** The board as the person should see it right now, optimistic change included. */
  shown: JobApplication[];
  /** True while that one card has a write outstanding, of either kind. */
  isCardBusy: (cardId: string) => boolean;
  error: string | null;
  moveCard: (move: CardMove) => void;
  removeCard: (cardId: string) => void;
}

/**
 * One change to the shown list, from either of the two writes the board makes.
 *
 * A discriminated change rather than a second useOptimistic: two of them over
 * the same server list give two candidate answers to "what does the board show",
 * and the case where a card is moved and then deleted before either settles has
 * to have one. Here it is a sequence of changes over one list.
 */
type BoardChange =
  | { kind: "move"; cardId: string; to: JobApplication["status"]; at: Date }
  | { kind: "remove"; cardId: string };

function applyChange(applications: JobApplication[], change: BoardChange): JobApplication[] {
  if (change.kind === "remove") {
    // Filters, never rewrites: a deleted card has no badge to update, and a
    // second side effect here is the kind of thing a merged reducer acquires
    // without anyone noticing.
    return applications.filter((application) => application.id !== change.cardId);
  }
  return applications.map((application) =>
    application.id === change.cardId
      ? // statusChangedAt as well as status. The write this stands for provably
        // resets it - planStatusChange does, on any real status change - so a
        // card showing its old day count in a new column would be stating the
        // one thing the board knows to be wrong.
        { ...application, status: change.to, statusChangedAt: change.at }
      : application,
  );
}

/**
 * Coordinates the board's writes: optimistic placement or removal, the write
 * itself, which cards are held while writing, and the failure message.
 *
 * `now` is the instant the board was served. It is required rather than
 * defaulted: a default would let a caller forget it and have this reach for a
 * clock, which is the one thing the day-count design removes.
 *
 * Separate from Board because dnd-kit cannot be driven in jsdom — it needs real
 * layout — so none of this would be testable if it lived in the component. Here
 * it is reachable with the actions mocked.
 */
export function useBoardCards(applications: JobApplication[], now: Date): BoardCards {
  // Derived from the server list each render, so once revalidation lands the
  // stored data wins by construction rather than by manual reconciliation.
  const [shown, addOptimisticChange] = useOptimistic(applications, applyChange);
  // A set, not one id: two cards can be writing at once, and releasing the
  // first because a second started is exactly the ordering the spec forbids.
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  /**
   * The shape both writes share: clear the last message, hold the card, show
   * the change, run the write, report what it says, release the card.
   *
   * `fallback` is the message used if the action breaks its promise and rejects.
   * The action is typed never to reject, and does not; this is here because the
   * cost of being wrong about that is the whole board — an unhandled rejection
   * in a transition reaches the nearest error boundary, which replaces the page.
   */
  const run = useCallback(
    <T>(
      change: BoardChange,
      write: () => Promise<ActionResult<T>>,
      fallback: string,
    ) => {
      setError(null);
      setPending((current) => new Set(current).add(change.cardId));

      startTransition(async () => {
        addOptimisticChange(change);
        try {
          const result = await write();
          if (!result.ok) {
            setError(result.error);
          }
        } catch (rejection) {
          console.error(rejection);
          setError(fallback);
        } finally {
          // Release only this card, and whatever happened. Another card's write
          // may still be outstanding, and a release that sits after the await is
          // one a failure never reaches - which left the card held for good.
          setPending((current) => {
            const next = new Set(current);
            next.delete(change.cardId);
            return next;
          });
        }
      });
    },
    [addOptimisticChange],
  );

  const moveCard = useCallback(
    (move: CardMove) =>
      run(
        // The instant the board was served, not a fresh one: a rendered number
        // must not come from the client clock, and the difference between the
        // two is at most the age of the page.
        { kind: "move", cardId: move.cardId, to: move.to, at: now },
        () => updateApplicationStatus(move.cardId, move.to),
        FAILED.move,
      ),
    [run, now],
  );

  /**
   * Nothing here restores the card on a failure: the optimistic change is
   * dropped when the transition settles, and the server list is what the board
   * falls back to. That is also why a deletion of a row that is already gone
   * leaves no card behind — the action revalidates on its not-found branch, so
   * the list it falls back to no longer has it.
   */
  const removeCard = useCallback(
    (cardId: string) =>
      run({ kind: "remove", cardId }, () => deleteApplication(cardId), FAILED.remove),
    [run],
  );

  const isCardBusy = useCallback((cardId: string) => pending.has(cardId), [pending]);

  return { shown, isCardBusy, error, moveCard, removeCard };
}
