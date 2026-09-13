import { describe, expect, it } from "vitest";
import { isApplicationStatus, planStatusChange } from "./status";

const NOW = new Date("2026-09-13T12:00:00.000Z");
const EARLIER = new Date("2026-08-01T09:00:00.000Z");

describe("planStatusChange", () => {
  it("returns null when the status doesn't change", () => {
    expect(
      planStatusChange({ status: "APPLIED", appliedDate: EARLIER }, "APPLIED", NOW),
    ).toBeNull();
  });

  it("sets status and statusChangedAt on a real transition", () => {
    expect(
      planStatusChange({ status: "APPLIED", appliedDate: EARLIER }, "INTERVIEW", NOW),
    ).toEqual({ status: "INTERVIEW", statusChangedAt: NOW });
  });

  it("sets appliedDate on the first transition into APPLIED", () => {
    expect(
      planStatusChange({ status: "WISHLIST", appliedDate: null }, "APPLIED", NOW),
    ).toEqual({ status: "APPLIED", statusChangedAt: NOW, appliedDate: NOW });
  });

  it("keeps the original appliedDate when moving into APPLIED again", () => {
    const change = planStatusChange(
      { status: "REJECTED", appliedDate: EARLIER },
      "APPLIED",
      NOW,
    );
    expect(change).toEqual({ status: "APPLIED", statusChangedAt: NOW });
    expect(change).not.toHaveProperty("appliedDate");
  });

  it("doesn't set appliedDate when skipping APPLIED entirely", () => {
    expect(
      planStatusChange({ status: "WISHLIST", appliedDate: null }, "INTERVIEW", NOW),
    ).toEqual({ status: "INTERVIEW", statusChangedAt: NOW });
  });
});

describe("isApplicationStatus", () => {
  it.each(["WISHLIST", "APPLIED", "INTERVIEW", "OFFER", "REJECTED"])(
    "accepts %s",
    (value) => {
      expect(isApplicationStatus(value)).toBe(true);
    },
  );

  it.each(["applied", "ARCHIVED", "", null, undefined, 1])("rejects %j", (value) => {
    expect(isApplicationStatus(value)).toBe(false);
  });
});
