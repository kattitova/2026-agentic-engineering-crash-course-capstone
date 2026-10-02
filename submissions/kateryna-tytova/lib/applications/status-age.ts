import { ApplicationStatus } from "@/app/generated/prisma/enums";

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

/**
 * How long an application may sit in Applied before the board flags it.
 *
 * Inclusive: 14 whole days counts. `spec.md` words MVP item 6 twice - "more
 * than 14 days" and "statusChangedAt older than 14 days" - and those readings
 * differ by a day. The deciding argument is the display rather than the English:
 * the card already shows "14d", and not flagging it while a card reading "15d"
 * is flagged looks arbitrary, with nothing on the card to explain why. It also
 * matches what the floored count means, since `daysInStatus` returning 14 covers
 * everything from exactly 14 days to just under 15.
 */
export const STALE_AFTER_DAYS = 14;

/**
 * Whether an application has gone quiet: in Applied, and there for long enough.
 *
 * Both halves are required. Applied is the one stage where silence carries
 * information - the application went out and nothing came back. A Wishlist card
 * is a bookmark and a Rejected one is finished, however old either is.
 *
 * Takes the two fields the rule is defined on rather than a whole
 * JobApplication, so it is callable from a test without building a row, and so
 * it is honest about what it reads.
 *
 * `now` is an argument for the same reason `daysInStatus` takes one: the card
 * that renders this is in the client bundle, so it renders on the server and
 * again on hydration, and a clock in here would make the flag flicker.
 */
export function hasNoMovement(
  application: { status: ApplicationStatus; statusChangedAt: Date },
  now: Date,
): boolean {
  if (application.status !== ApplicationStatus.APPLIED) {
    return false;
  }
  // Calls the count rather than subtracting dates again, so the flag and the
  // badge beside it can never disagree about how old a card is.
  return daysInStatus(application.statusChangedAt, now) >= STALE_AFTER_DAYS;
}
