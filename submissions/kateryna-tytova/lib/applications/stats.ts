import { ApplicationStatus } from "@/app/generated/prisma/enums";
import type { ApplicationsByStatus } from "./board";

export interface BoardSummary {
  /** Applications on the board, across every status. */
  total: number;
  /** Of those, the ones that reached the interview stage. */
  reachedInterview: number;
  /**
   * The share as a whole percentage, or null when there is nothing to measure.
   *
   * Nullable rather than 0: a share of an empty set is not zero, and
   * "0% reached the interview stage" is a statement about a job search that has
   * not started. Returning 0 would have type-checked, rendered that sentence on
   * an empty board, and failed nothing.
   */
  percentReachedInterview: number | null;
}

/**
 * The statuses that count as having reached the interview stage.
 *
 * Only the two, and the omission of REJECTED is the decision rather than an
 * oversight: the stored row carries one status and the moment it was last set,
 * with no history of the statuses an application passed through, so a rejected
 * application cannot be known to have been interviewed before the rejection.
 * Counting it would treat every rejection as post-interview and overstate the
 * one figure whose job is to say whether the search is working. The cost is a
 * known undercount in the other direction, which is why the region names what
 * it counts on screen.
 */
const REACHED_INTERVIEW: readonly ApplicationStatus[] = [
  ApplicationStatus.INTERVIEW,
  ApplicationStatus.OFFER,
];

/**
 * Summarises the board for the region above it.
 *
 * Takes the **grouped** board, not a flat list of rows, and that is the whole
 * design. The summary has to agree with the cards — its total is the one number
 * the person can check against them — and `groupApplicationsByStatus` is what
 * decides which rows become cards, dropping any whose stored status is not one
 * of the five. Counting its output makes the agreement structural: there is no
 * second filter here that could disagree with it, and a row with an unknown
 * status is absent from both figures because it was already absent from the
 * input. Nothing below asks a row what its status is.
 */
export function summariseBoard(grouped: ApplicationsByStatus): BoardSummary {
  let total = 0;
  for (const applications of Object.values(grouped)) {
    total += applications.length;
  }

  let reachedInterview = 0;
  for (const status of REACHED_INTERVIEW) {
    reachedInterview += grouped[status].length;
  }

  return {
    total,
    reachedInterview,
    percentReachedInterview: percentReached(reachedInterview, total),
  };
}

/**
 * The share, rounded to whole percent and clamped away from both ends.
 *
 * Ordinary rounding can cross either boundary with plausible numbers: 1 of 201
 * rounds to 0% and 200 of 201 rounds to 100%. The first reports the opposite of
 * what happened, and the second reports a search as finished while an
 * application is still open. So 0% is reserved for "none" and 100% for "all";
 * everything strictly between them shows as 1% to 99%.
 *
 * The accepted cost is that 1 of 201 and 2 of 201 both read 1%. A gauge that
 * cannot say "none" when there is one is worth less than that distinction.
 */
function percentReached(reached: number, total: number): number | null {
  if (total === 0) {
    return null;
  }

  const rounded = Math.round((100 * reached) / total);
  if (rounded === 0 && reached > 0) {
    return 1;
  }
  if (rounded === 100 && reached < total) {
    return 99;
  }
  return rounded;
}
