const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Whole days that have passed since an application's status last changed.
 *
 * Elapsed days, not calendar days: a card reads as one day old once a full day
 * has gone by, not when the date rolls over. A calendar count needs a timezone,
 * and the one the board renders in is not guaranteed to be the viewer's, so the
 * number could be wrong by one for a reason the person cannot see. It also
 * makes MVP item 6's rule exactly what spec.md already writes - statusChangedAt
 * older than 14 days - with no second notion of a day to reconcile.
 *
 * `now` is an argument and there is no clock in here, for two reasons. The card
 * that renders this is in the client bundle and so renders twice, on the server
 * for the HTML and again on hydration; a clock inside would give two different
 * numbers and mismatch. And a pure function of two instants is testable without
 * mocking anything, which is what MVP item 6 will threshold.
 *
 * Never negative. The database does not enforce that statusChangedAt is in the
 * past - a clock set back, a hand-edited row or a seed script can put it ahead -
 * and "-3 days in this status" is not something to render.
 */
export function daysInStatus(statusChangedAt: Date, now: Date): number {
  const elapsed = now.getTime() - statusChangedAt.getTime();
  if (elapsed <= 0) {
    return 0;
  }
  return Math.floor(elapsed / DAY_MS);
}

export interface DaysInStatusText {
  /** What the badge shows, short enough to sit on a card. */
  short: string;
  /** What assistive technology reads. */
  full: string;
}

/**
 * The two forms of the count: one for the eye, one for a screen reader.
 *
 * Two strings rather than one because the card has room for an abbreviation and
 * a screen reader needs the words - the same split BoardColumn's count already
 * makes, for the same reason.
 *
 * `full` names the status rather than saying "in this status". A card's
 * accessible name is its company, and its status is carried only by the column
 * landmark around it, so "in this status" is a phrase the listener cannot
 * resolve without leaving the card.
 *
 * The label is an argument, taken from BOARD_COLUMNS at the call site, so this
 * function never invents a sixth spelling of a status name.
 */
export function describeDaysInStatus(days: number, statusLabel: string): DaysInStatusText {
  if (days === 0) {
    // Not "0 days", which reads as a count that failed rather than as a
    // statement about today.
    return { short: "Today", full: `Today in ${statusLabel}` };
  }
  return {
    short: `${days}d`,
    full: `${days} ${days === 1 ? "day" : "days"} in ${statusLabel}`,
  };
}
