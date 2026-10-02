import { describe, expect, it } from "vitest";
import type { JobApplication } from "@/app/generated/prisma/client";
import { ApplicationStatus } from "@/app/generated/prisma/enums";
import { groupApplicationsByStatus } from "./board";
import { summariseBoard } from "./stats";

const TIMESTAMP = new Date("2026-09-01T00:00:00.000Z");

function application(id: string, status: ApplicationStatus): JobApplication {
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
  };
}

/**
 * A board described by how many applications sit in each status.
 *
 * Built through `groupApplicationsByStatus`, never by assembling the record by
 * hand: the summary's guarantee is that its total equals the number of cards the
 * board shows, and the only way a test can hold that is to go through the same
 * grouping the board goes through.
 */
function board(counts: Partial<Record<ApplicationStatus, number>>, extra: JobApplication[] = []) {
  const applications: JobApplication[] = [];
  for (const [status, count] of Object.entries(counts)) {
    for (let index = 0; index < count; index += 1) {
      applications.push(application(`${status}-${index}`, status as ApplicationStatus));
    }
  }
  return groupApplicationsByStatus([...applications, ...extra]);
}

describe("summariseBoard", () => {
  it("counts every status in the total and only Interview and Offer in the share", () => {
    const summary = summariseBoard(
      board({ WISHLIST: 5, APPLIED: 4, INTERVIEW: 2, OFFER: 1, REJECTED: 3 }),
    );

    expect(summary.total).toBe(15);
    expect(summary.reachedInterview).toBe(3);
    expect(summary.percentReachedInterview).toBe(20);
  });

  it("measures the share against Wishlist and Applied rather than excluding them", () => {
    const summary = summariseBoard(board({ WISHLIST: 5, APPLIED: 4, INTERVIEW: 1 }));

    expect(summary.total).toBe(10);
    expect(summary.percentReachedInterview).toBe(10);
  });

  it("counts a single Offer as having reached interview", () => {
    const summary = summariseBoard(board({ OFFER: 1 }));

    expect(summary.total).toBe(1);
    expect(summary.reachedInterview).toBe(1);
    expect(summary.percentReachedInterview).toBe(100);
  });

  it("does not count a Rejected application as having reached interview", () => {
    const summary = summariseBoard(board({ APPLIED: 2, REJECTED: 3 }));

    expect(summary.total).toBe(5);
    expect(summary.reachedInterview).toBe(0);
    expect(summary.percentReachedInterview).toBe(0);
  });

  it("reports zero when nothing has reached interview", () => {
    const summary = summariseBoard(board({ WISHLIST: 3, APPLIED: 5 }));

    expect(summary.total).toBe(8);
    expect(summary.percentReachedInterview).toBe(0);
  });

  it("reports one hundred when everything has reached interview", () => {
    const summary = summariseBoard(board({ INTERVIEW: 3, OFFER: 1 }));

    expect(summary.total).toBe(4);
    expect(summary.percentReachedInterview).toBe(100);
  });

  it("has no percentage at all for an empty board", () => {
    const summary = summariseBoard(board({}));

    expect(summary.total).toBe(0);
    expect(summary.reachedInterview).toBe(0);
    // null, not 0: a share of an empty set is not zero, and the call site is
    // made to handle the case by the type rather than by remembering to.
    expect(summary.percentReachedInterview).toBeNull();
  });

  it("rounds the share to a whole number", () => {
    const summary = summariseBoard(board({ APPLIED: 2, INTERVIEW: 1 }));

    expect(summary.percentReachedInterview).toBe(33);
  });

  it("never rounds a single success down to nothing", () => {
    const summary = summariseBoard(board({ APPLIED: 200, INTERVIEW: 1 }));

    // Exactly 1, not merely "not 0": an implementation returning 0.49 or 0.5
    // would satisfy the weaker assertion while breaking the whole-number rule.
    expect(summary.percentReachedInterview).toBe(1);
  });

  it("never rounds a single remaining application away to one hundred", () => {
    const summary = summariseBoard(board({ APPLIED: 1, INTERVIEW: 100, OFFER: 100 }));

    expect(summary.total).toBe(201);
    expect(summary.reachedInterview).toBe(200);
    expect(summary.percentReachedInterview).toBe(99);
  });

  it("leaves an application with an unrecognised stored status out of both figures", () => {
    // SQLite doesn't enforce the enum, so a seed script or a hand edit can store
    // anything. The cast reproduces that row; it can't arise from the typed API.
    const unknown = application("bad", "ARCHIVED" as ApplicationStatus);

    const summary = summariseBoard(board({ WISHLIST: 1, APPLIED: 1, INTERVIEW: 1 }, [unknown]));

    expect(summary.total).toBe(3);
    expect(summary.reachedInterview).toBe(1);
    expect(summary.percentReachedInterview).toBe(33);
  });
});
