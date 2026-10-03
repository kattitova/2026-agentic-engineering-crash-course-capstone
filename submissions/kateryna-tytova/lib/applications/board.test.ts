import { describe, expect, it } from "vitest";
import type { JobApplication } from "@/app/generated/prisma/client";
import { ApplicationStatus } from "@/app/generated/prisma/enums";
import { BOARD_COLUMNS, groupApplicationsByStatus, statusLabel } from "./board";

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

  it("gives every column its own colour for the status dot", () => {
    const dotClasses = BOARD_COLUMNS.map((column) => column.dotClass);

    // Pinned, not just non-empty: two columns sharing a colour makes the funnel
    // unreadable, and a typo'd Tailwind class renders no dot at all.
    expect(dotClasses).toEqual([
      "bg-slate-400",
      "bg-sky-500",
      "bg-violet-500",
      "bg-emerald-500",
      "bg-rose-400",
    ]);
    expect(new Set(dotClasses).size).toBe(dotClasses.length);
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

  it("skips an application whose stored status is not one of the five", () => {
    // SQLite doesn't enforce the enum, so a seed script or a hand edit can store
    // anything. The cast reproduces that row; it can't arise from the typed API.
    const unknown = application("bad", "ARCHIVED" as ApplicationStatus);
    const applied = application("good", "APPLIED");

    const grouped = groupApplicationsByStatus([unknown, applied]);

    expect(grouped.APPLIED).toEqual([applied]);
    expect(BOARD_COLUMNS.flatMap((column) => grouped[column.status])).toEqual([applied]);
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

describe("statusLabel", () => {
  it("names every status the way its column does", () => {
    // One source for the five, so the card's badge, the chooser and the column
    // heading can never disagree about what a status is called.
    for (const column of BOARD_COLUMNS) {
      expect(statusLabel(column.status)).toBe(column.label);
    }
  });

  it("falls back to the stored value for a status with no column", () => {
    // SQLite does not enforce the enum, and the type cannot say a status is one of
    // the five, so the answer for anything else is the value itself.
    expect(statusLabel("ARCHIVED" as ApplicationStatus)).toBe("ARCHIVED");
  });
});
