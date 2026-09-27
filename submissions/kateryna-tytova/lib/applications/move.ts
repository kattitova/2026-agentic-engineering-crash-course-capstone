import type { ApplicationStatus } from "@/app/generated/prisma/enums";
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
