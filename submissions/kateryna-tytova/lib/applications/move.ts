import type { ApplicationStatus } from "@/app/generated/prisma/enums";
import { BOARD_COLUMNS, type BoardColumn } from "./board";
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

/**
 * The columns a card can be moved to by choosing one: every column but the one
 * it is already in, in funnel order.
 *
 * The current column is left out rather than offered and ignored. A move to it
 * plans no move, so offering it would invite a choice that does nothing.
 *
 * Derived from BOARD_COLUMNS so the five statuses and their order stay in one
 * place.
 */
export function movableColumns(from: ApplicationStatus): readonly BoardColumn[] {
  return BOARD_COLUMNS.filter((column) => column.status !== from);
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

/** A measured column, as the board lays it out on screen. */
export interface ColumnRect {
  status: ApplicationStatus;
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * The column whose rectangle contains `point`, or null if none does.
 *
 * Both axes matter. The board's grid wraps below `xl`, and once it does, Offer
 * sits directly below Wishlist at the same `left` — so a lookup that compares
 * only the horizontal edge cannot tell them apart.
 */
export function columnAtPoint(
  columns: readonly ColumnRect[],
  point: { x: number; y: number },
): ApplicationStatus | null {
  const hit = columns.find(
    (column) =>
      point.x >= column.left &&
      point.x <= column.left + column.width &&
      point.y >= column.top &&
      point.y <= column.top + column.height,
  );
  return hit?.status ?? null;
}

/**
 * Where to place a picked-up card so it lands on the next column along the
 * funnel, or null when there is no such column or it was never measured.
 *
 * Returns both coordinates, not just `x`: the next column in funnel order can
 * be on the next row, and carrying the old `y` over would drop the card on
 * whichever column shares that row instead.
 */
export function keyboardStep(
  columns: readonly ColumnRect[],
  from: ApplicationStatus,
  direction: ColumnDirection,
): { x: number; y: number } | null {
  const target = adjacentColumn(from, direction);
  if (target === null) {
    return null;
  }
  const rect = columns.find((column) => column.status === target);
  return rect ? { x: rect.left, y: rect.top } : null;
}
