import { describe, expect, it } from "vitest";
import { ApplicationStatus } from "@/app/generated/prisma/enums";
import { BOARD_COLUMNS } from "./board";
import { adjacentColumn, planCardMove } from "./move";

describe("planCardMove", () => {
  it("plans a move when the card is dropped on a different column", () => {
    expect(planCardMove("card-1", ApplicationStatus.APPLIED, ApplicationStatus.INTERVIEW)).toEqual({
      cardId: "card-1",
      from: ApplicationStatus.APPLIED,
      to: ApplicationStatus.INTERVIEW,
    });
  });

  it("plans no move when the card is dropped on the column it already holds", () => {
    // Not merely pointless: the server resets nothing on a same-status write, but
    // not calling it keeps updatedAt untouched too.
    expect(planCardMove("card-1", ApplicationStatus.OFFER, ApplicationStatus.OFFER)).toBeNull();
  });

  it("plans no move when the drag is released outside any column", () => {
    expect(planCardMove("card-1", ApplicationStatus.APPLIED, null)).toBeNull();
  });

  it("plans no move when the drop target is not a known status", () => {
    // The drop target id arrives from the DOM, so it is untrusted like any other
    // client-supplied value.
    expect(planCardMove("card-1", ApplicationStatus.APPLIED, "ARCHIVED")).toBeNull();
  });

  it("plans no move without a card id", () => {
    expect(planCardMove("", ApplicationStatus.APPLIED, ApplicationStatus.OFFER)).toBeNull();
  });

  it("plans a move between any two different statuses", () => {
    const statuses = Object.values(ApplicationStatus);

    for (const from of statuses) {
      for (const to of statuses) {
        const plan = planCardMove("card-1", from, to);
        expect(plan === null).toBe(from === to);
      }
    }
  });
});

describe("adjacentColumn", () => {
  it("steps forward through the funnel", () => {
    expect(adjacentColumn(ApplicationStatus.WISHLIST, 1)).toBe(ApplicationStatus.APPLIED);
    expect(adjacentColumn(ApplicationStatus.APPLIED, 1)).toBe(ApplicationStatus.INTERVIEW);
    expect(adjacentColumn(ApplicationStatus.OFFER, 1)).toBe(ApplicationStatus.REJECTED);
  });

  it("steps backward through the funnel", () => {
    expect(adjacentColumn(ApplicationStatus.REJECTED, -1)).toBe(ApplicationStatus.OFFER);
    expect(adjacentColumn(ApplicationStatus.APPLIED, -1)).toBe(ApplicationStatus.WISHLIST);
  });

  it("stops at both ends rather than wrapping", () => {
    // Wrapping would move a card from Rejected to Wishlist on one key press,
    // which is never what the person meant.
    expect(adjacentColumn(ApplicationStatus.WISHLIST, -1)).toBeNull();
    expect(adjacentColumn(ApplicationStatus.REJECTED, 1)).toBeNull();
  });

  it("follows funnel order, not the enum's declaration order", () => {
    const walked: ApplicationStatus[] = [ApplicationStatus.WISHLIST];
    let current: ApplicationStatus | null = ApplicationStatus.WISHLIST;
    while ((current = adjacentColumn(current, 1)) !== null) {
      walked.push(current);
    }

    expect(walked).toEqual(BOARD_COLUMNS.map((column) => column.status));
  });
});
