import { describe, expect, it } from "vitest";
import { daysInStatus, describeDaysInStatus, hasNoMovement } from "./status-age";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** A fixed instant, so nothing here depends on when the suite runs. */
const NOW = new Date("2026-10-02T09:00:00.000Z");
const ago = (ms: number) => new Date(NOW.getTime() - ms);

describe("daysInStatus", () => {
  it("counts whole days that have passed", () => {
    expect(daysInStatus(ago(12 * DAY), NOW)).toBe(12);
  });

  it("counts exactly one day at exactly 24 hours", () => {
    expect(daysInStatus(ago(DAY), NOW)).toBe(1);
  });

  it("counts nothing one minute short of a day", () => {
    expect(daysInStatus(ago(DAY - 60 * 1000), NOW)).toBe(0);
  });

  it("counts nothing 20 hours later even though the calendar date changed", () => {
    // The case that separates elapsed days from calendar days, and the reason
    // the rule is elapsed: 13:00 on the 1st read at 09:00 on the 2nd is a new
    // date but not a whole day. A calendar count would say 1 here and would
    // need a timezone to say even that.
    const changed = new Date("2026-10-01T13:00:00.000Z");
    expect(daysInStatus(changed, NOW)).toBe(0);
  });

  it("never returns a negative count when the stored moment is in the future", () => {
    // The database does not enforce that statusChangedAt is in the past: a
    // clock set back, a hand-edited row or a seed script can put it ahead.
    expect(daysInStatus(new Date(NOW.getTime() + 5 * DAY), NOW)).toBe(0);
    expect(daysInStatus(new Date(NOW.getTime() + 1), NOW)).toBe(0);
  });

  it("counts a very old moment without clamping or overflowing", () => {
    expect(daysInStatus(ago(5000 * DAY), NOW)).toBe(5000);
  });

  it("counts zero when the moment is the instant itself", () => {
    expect(daysInStatus(NOW, NOW)).toBe(0);
  });

  it("reads its `now` argument rather than calling a clock of its own", () => {
    // The one defect worth catching here. A function that ignored `now` and
    // used Date.now() internally would pass every test above - they all share
    // one NOW - and would reintroduce the clock the whole design removes.
    const changed = ago(12 * DAY);
    const later = new Date(NOW.getTime() + 3 * DAY);

    expect(daysInStatus(changed, NOW)).toBe(12);
    expect(daysInStatus(changed, later)).toBe(15);
  });
});

describe("describeDaysInStatus", () => {
  it("says today rather than zero days", () => {
    // "0 days in Interview" reads as a count that failed. The zero case is the
    // price of counting elapsed days rather than calendar days, and wording is
    // where it is paid - not in the arithmetic.
    expect(describeDaysInStatus(0, "Interview")).toEqual({
      short: "Today",
      full: "Today in Interview",
    });
  });

  it("uses the singular for exactly one day", () => {
    expect(describeDaysInStatus(1, "Interview")).toEqual({
      short: "1d",
      full: "1 day in Interview",
    });
  });

  it("uses the plural beyond one", () => {
    expect(describeDaysInStatus(12, "Interview")).toEqual({
      short: "12d",
      full: "12 days in Interview",
    });
  });

  it("names whichever status it is given", () => {
    // The label comes from BOARD_COLUMNS at the call site, so this function
    // never invents a sixth spelling of a status name.
    expect(describeDaysInStatus(3, "Wishlist").full).toBe("3 days in Wishlist");
    expect(describeDaysInStatus(3, "Rejected").full).toBe("3 days in Rejected");
  });

  it("keeps the abbreviation short for a very large count", () => {
    expect(describeDaysInStatus(5000, "Offer")).toEqual({
      short: "5000d",
      full: "5000 days in Offer",
    });
  });
});

describe("hasNoMovement", () => {
  /** The two fields the rule is defined on, and nothing else. */
  const inStatus = (status: string, daysAgo: number) => ({
    status: status as never,
    statusChangedAt: ago(daysAgo * DAY),
  });

  it("flags an application that has sat in Applied well past the threshold", () => {
    expect(hasNoMovement(inStatus("APPLIED", 30), NOW)).toBe(true);
  });

  it("flags one at exactly the threshold", () => {
    // The inclusive edge, argued from what the card shows: it reads "14d", and
    // not flagging it while a card reading "15d" is flagged would look arbitrary
    // with nothing on the card to explain the difference.
    expect(hasNoMovement(inStatus("APPLIED", 14), NOW)).toBe(true);
  });

  it("does not flag one a day short of the threshold", () => {
    expect(hasNoMovement(inStatus("APPLIED", 13), NOW)).toBe(false);
  });

  it("does not flag one that has just arrived in Applied", () => {
    expect(hasNoMovement(inStatus("APPLIED", 0), NOW)).toBe(false);
  });

  it.each(["WISHLIST", "INTERVIEW", "OFFER", "REJECTED"])(
    "does not flag an old application in %s",
    (status) => {
      // The half of the rule most easily lost. Applied is the one stage where
      // silence carries information - the application went out and nothing came
      // back. A Wishlist card is a bookmark and a Rejected one is finished,
      // however old either is.
      expect(hasNoMovement(inStatus(status, 200), NOW)).toBe(false);
    },
  );

  it("reads its `now` argument rather than calling a clock of its own", () => {
    // Every case above shares one NOW, so a predicate that ignored `now` and
    // used Date.now() internally would pass all of them.
    const application = inStatus("APPLIED", 0);
    const beforeThreshold = new Date(application.statusChangedAt.getTime() + 13 * DAY);
    const afterThreshold = new Date(application.statusChangedAt.getTime() + 14 * DAY);

    expect(hasNoMovement(application, beforeThreshold)).toBe(false);
    expect(hasNoMovement(application, afterThreshold)).toBe(true);
  });
});
