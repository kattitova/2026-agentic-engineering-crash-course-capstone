import { describe, expect, it } from "vitest";
import { daysInStatus, describeDaysInStatus } from "./status-age";

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
