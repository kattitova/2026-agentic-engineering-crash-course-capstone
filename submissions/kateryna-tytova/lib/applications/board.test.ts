import { describe, expect, it } from "vitest";
import type { JobApplication } from "@/app/generated/prisma/client";
import { ApplicationStatus } from "@/app/generated/prisma/enums";
import { BOARD_COLUMNS, groupApplicationsByStatus } from "./board";

const TIMESTAMP = new Date("2026-09-01T00:00:00.000Z");

function application(
  id: string,
  status: ApplicationStatus,
  overrides: Partial<JobApplication> = {},
): JobApplication {
  return {
    id,
    company: `Company ${id}`,
    position: "Developer",
    status,
    link: null,
    notes: null,
    appliedDate: null,
    statusChangedAt: TIMESTAMP,
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
    ...overrides,
  };
}

describe("BOARD_COLUMNS", () => {
  it("lists the five statuses in funnel order", () => {
    expect(BOARD_COLUMNS.map((column) => column.status)).toEqual([
      "WISHLIST",
      "APPLIED",
      "INTERVIEW",
      "OFFER",
      "REJECTED",
    ]);
  });

  it("covers every status exactly once", () => {
    const statuses = BOARD_COLUMNS.map((column) => column.status);
    expect(new Set(statuses).size).toBe(statuses.length);
    expect(statuses).toHaveLength(Object.values(ApplicationStatus).length);
  });

  it("gives every column a human-readable label", () => {
    expect(BOARD_COLUMNS.map((column) => column.label)).toEqual([
      "Wishlist",
      "Applied",
      "Interview",
      "Offer",
      "Rejected",
    ]);
  });

  it("gives every column a colour for its status dot", () => {
    for (const column of BOARD_COLUMNS) {
      expect(column.dotClass.trim()).not.toBe("");
    }
  });
});

describe("groupApplicationsByStatus", () => {
  it("returns an empty array for every status when there are no applications", () => {
    expect(groupApplicationsByStatus([])).toEqual({
      WISHLIST: [],
      APPLIED: [],
      INTERVIEW: [],
      OFFER: [],
      REJECTED: [],
    });
  });

  it("puts each application in the group for its status", () => {
    const wishlist = application("a", "WISHLIST");
    const interview = application("b", "INTERVIEW");

    const grouped = groupApplicationsByStatus([wishlist, interview]);

    expect(grouped.WISHLIST).toEqual([wishlist]);
    expect(grouped.INTERVIEW).toEqual([interview]);
    expect(grouped.APPLIED).toEqual([]);
    expect(grouped.OFFER).toEqual([]);
    expect(grouped.REJECTED).toEqual([]);
  });

  it("keeps the input order inside a group", () => {
    const first = application("first", "APPLIED");
    const second = application("second", "APPLIED");
    const third = application("third", "APPLIED");

    const grouped = groupApplicationsByStatus([first, second, third]);

    expect(grouped.APPLIED.map((item) => item.id)).toEqual(["first", "second", "third"]);
  });

  it("loses and duplicates nothing", () => {
    const applications = [
      application("a", "WISHLIST"),
      application("b", "APPLIED"),
      application("c", "APPLIED"),
      application("d", "OFFER"),
      application("e", "REJECTED"),
    ];

    const grouped = groupApplicationsByStatus(applications);
    const groupedIds = BOARD_COLUMNS.flatMap((column) =>
      grouped[column.status].map((item) => item.id),
    );

    expect(groupedIds.sort()).toEqual(["a", "b", "c", "d", "e"]);
  });
});
