import type { ApplicationStatus } from "@/app/generated/prisma/enums";
import { BOARD_COLUMNS } from "./board";
import { isApplicationStatus } from "./status";

export interface CardMove {
  cardId: string;
  from: ApplicationStatus;
  to: ApplicationStatus;
}

/**
 * Decides whether a released drag is a move worth sending to the server.
 *
 * Returns null for every case that is not: a drop on the card's own column, a
 * release outside any column, a drop target that is not one of the five
 * statuses, or a missing card id. The drop target comes from the DOM, so it is
 * as untrusted as any other client-supplied value.
 *
 * Kept out of the component so the rule is testable without a DOM and without
 * dnd-kit.
 */
export function planCardMove(
  cardId: string,
  from: ApplicationStatus,
  to: unknown,
): CardMove | null {
  if (cardId === "") {
    return null;
  }
  if (!isApplicationStatus(to) || to === from) {
    return null;
  }
  return { cardId, from, to };
}

/** -1 moves towards Wishlist, 1 towards Rejected. */
export type ColumnDirection = -1 | 1;

/**
 * The column one step from `from` in funnel order, or null at either end.
 *
 * This is what makes a keyboard move land on the next column. dnd-kit's default
 * keyboard sensor translates the drag by a flat 25px per arrow key, and columns
 * are an order of magnitude wider than that, so the card would never leave the
 * column it started in. The sensor's coordinateGetter resolves the target
 * column through this function and jumps to its rect.
 *
 * Deliberately does not wrap: one key press carrying a card from Rejected back
 * to Wishlist is never what the person meant.
 */
export function adjacentColumn(
  from: ApplicationStatus,
  direction: ColumnDirection,
): ApplicationStatus | null {
  const index = BOARD_COLUMNS.findIndex((column) => column.status === from);
  if (index === -1) {
    return null;
  }
  return BOARD_COLUMNS[index + direction]?.status ?? null;
}
