import { describe, expect, it } from "vitest";
import { ApplicationStatus } from "@/app/generated/prisma/enums";
import { BOARD_COLUMNS } from "./board";
import {
  adjacentColumn,
  columnAtPoint,
  keyboardStep,
  movableColumns,
  planCardMove,
  type ColumnRect,
} from "./move";

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

// Geometry measured from the running board, so the fixtures are not invented:
// at 1280px the five columns share a row; at 1100px the grid wraps to three and
// then two, which puts Offer directly below Wishlist at the same `left`.
const ONE_ROW: ColumnRect[] = [
  { status: ApplicationStatus.WISHLIST, left: 40, top: 112, width: 243, height: 400 },
  { status: ApplicationStatus.APPLIED, left: 283, top: 112, width: 243, height: 400 },
  { status: ApplicationStatus.INTERVIEW, left: 526, top: 112, width: 243, height: 400 },
  { status: ApplicationStatus.OFFER, left: 770, top: 112, width: 243, height: 400 },
  { status: ApplicationStatus.REJECTED, left: 1013, top: 112, width: 243, height: 400 },
];

const TWO_ROWS: ColumnRect[] = [
  { status: ApplicationStatus.WISHLIST, left: 40, top: 112, width: 345, height: 160 },
  { status: ApplicationStatus.APPLIED, left: 385, top: 112, width: 345, height: 160 },
  { status: ApplicationStatus.INTERVIEW, left: 731, top: 112, width: 345, height: 160 },
  { status: ApplicationStatus.OFFER, left: 40, top: 289, width: 345, height: 160 },
  { status: ApplicationStatus.REJECTED, left: 385, top: 289, width: 345, height: 160 },
];

describe("columnAtPoint", () => {
  it("finds the column under a point", () => {
    expect(columnAtPoint(ONE_ROW, { x: 600, y: 200 })).toBe(ApplicationStatus.INTERVIEW);
  });

  it("tells apart two columns that share a left edge on different rows", () => {
    // The defect this exists to prevent: matching on `left` alone makes Offer
    // indistinguishable from Wishlist once the grid wraps.
    expect(columnAtPoint(TWO_ROWS, { x: 100, y: 150 })).toBe(ApplicationStatus.WISHLIST);
    expect(columnAtPoint(TWO_ROWS, { x: 100, y: 330 })).toBe(ApplicationStatus.OFFER);
  });

  it("returns null for a point outside every column", () => {
    expect(columnAtPoint(ONE_ROW, { x: 5, y: 5 })).toBeNull();
  });
});

describe("keyboardStep", () => {
  it("moves along the row when the columns share one", () => {
    expect(keyboardStep(ONE_ROW, ApplicationStatus.APPLIED, 1)).toEqual({ x: 526, y: 112 });
  });

  it("follows the funnel across a row boundary", () => {
    // Interview is last on row 1 and Offer is first on row 2. Returning Offer's
    // x with row 1's y lands the card on Wishlist and stores a status the person
    // never chose.
    expect(keyboardStep(TWO_ROWS, ApplicationStatus.INTERVIEW, 1)).toEqual({ x: 40, y: 289 });
  });

  it("steps backward across a row boundary too", () => {
    expect(keyboardStep(TWO_ROWS, ApplicationStatus.OFFER, -1)).toEqual({ x: 731, y: 112 });
  });

  it("stays put at both ends of the funnel", () => {
    expect(keyboardStep(TWO_ROWS, ApplicationStatus.WISHLIST, -1)).toBeNull();
    expect(keyboardStep(TWO_ROWS, ApplicationStatus.REJECTED, 1)).toBeNull();
  });

  it("returns null when the target column was never measured", () => {
    const withoutOffer = TWO_ROWS.filter((c) => c.status !== ApplicationStatus.OFFER);
    expect(keyboardStep(withoutOffer, ApplicationStatus.INTERVIEW, 1)).toBeNull();
  });
});

describe("movableColumns", () => {
  const ALL = Object.values(ApplicationStatus);

  it("offers the four columns a card is not in, in funnel order", () => {
    expect(movableColumns(ApplicationStatus.APPLIED).map((c) => c.status)).toEqual([
      ApplicationStatus.WISHLIST,
      ApplicationStatus.INTERVIEW,
      ApplicationStatus.OFFER,
      ApplicationStatus.REJECTED,
    ]);
  });

  it("never offers the column the card is already in", () => {
    // A move to the current column plans no move, so offering it would invite a
    // choice that does nothing.
    for (const status of ALL) {
      expect(movableColumns(status).map((c) => c.status)).not.toContain(status);
    }
  });

  it("offers four columns whichever status the card holds", () => {
    for (const status of ALL) {
      expect(movableColumns(status)).toHaveLength(4);
    }
  });

  it("keeps the order of the board rather than the enum's declaration order", () => {
    const funnel = BOARD_COLUMNS.map((c) => c.status);
    for (const status of ALL) {
      expect(movableColumns(status).map((c) => c.status)).toEqual(
        funnel.filter((s) => s !== status),
      );
    }
  });
});
