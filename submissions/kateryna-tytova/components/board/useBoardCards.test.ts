// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { JobApplication } from "@/app/generated/prisma/client";
import { ApplicationStatus } from "@/app/generated/prisma/enums";
import { FAILED, type ActionResult } from "@/lib/applications/action-result";
import { groupApplicationsByStatus } from "@/lib/applications/board";
import type { CardMove } from "@/lib/applications/move";
import { summariseBoard } from "@/lib/applications/stats";
import { useBoardCards } from "./useBoardCards";

const { updateApplicationStatus, deleteApplication } = vi.hoisted(() => ({
  updateApplicationStatus: vi.fn(),
  deleteApplication: vi.fn(),
}));

vi.mock("@/app/actions/applications", () => ({ updateApplicationStatus, deleteApplication }));

const TIMESTAMP = new Date("2026-09-01T00:00:00.000Z");

/**
 * The instant the board was served. Every badge is measured against it, and
 * an optimistic move stamps it onto the card it moves.
 */
const SERVED_AT = new Date("2026-09-20T00:00:00.000Z");

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

const APPLICATIONS = [
  application("a", ApplicationStatus.APPLIED),
  application("b", ApplicationStatus.WISHLIST),
];

const moveOf = (cardId: string, from: ApplicationStatus, to: ApplicationStatus): CardMove => ({
  cardId,
  from,
  to,
});

/** Lets a test decide when — and how — each pending write settles. */
function deferAction(action = updateApplicationStatus) {
  const settlers: ((result: ActionResult<JobApplication>) => void)[] = [];
  action.mockImplementation(
    () =>
      new Promise<ActionResult<JobApplication>>((resolve) => {
        settlers.push(resolve);
      }),
  );
  return settlers;
}

/** The deletion result shape, which carries only the id of the row that went. */
function deferDeletion() {
  const settlers: ((result: ActionResult<{ id: string }>) => void)[] = [];
  deleteApplication.mockImplementation(
    () =>
      new Promise<ActionResult<{ id: string }>>((resolve) => {
        settlers.push(resolve);
      }),
  );
  return settlers;
}

const idsOf = (cards: readonly JobApplication[]) => cards.map((card) => card.id);

beforeEach(() => {
  updateApplicationStatus.mockReset();
  deleteApplication.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useBoardCards", () => {
  it("shows the move before the server has confirmed it", async () => {
    const settlers = deferAction();
    const { result } = renderHook(() => useBoardCards(APPLICATIONS, SERVED_AT));

    act(() => {
      result.current.moveCard(moveOf("a", ApplicationStatus.APPLIED, ApplicationStatus.OFFER));
    });

    await waitFor(() => {
      expect(result.current.shown.find((item) => item.id === "a")?.status).toBe(
        ApplicationStatus.OFFER,
      );
    });

    await act(async () => {
      settlers[0]?.({ ok: true, data: application("a", ApplicationStatus.OFFER) });
    });
  });

  it("holds the moved card while its write is outstanding and releases it after", async () => {
    const settlers = deferAction();
    const { result } = renderHook(() => useBoardCards(APPLICATIONS, SERVED_AT));

    act(() => {
      result.current.moveCard(moveOf("a", ApplicationStatus.APPLIED, ApplicationStatus.OFFER));
    });
    await waitFor(() => expect(result.current.isCardBusy("a")).toBe(true));

    await act(async () => {
      settlers[0]?.({ ok: true, data: application("a", ApplicationStatus.OFFER) });
    });
    expect(result.current.isCardBusy("a")).toBe(false);
  });

  it("keeps a first card held when a second card is moved before it settles", async () => {
    // The defect this exists to prevent: one pending id instead of a set lets a
    // second drag re-enable the first card's handle while its write is still
    // outstanding, which is exactly the ordering the spec forbids.
    const settlers = deferAction();
    const { result } = renderHook(() => useBoardCards(APPLICATIONS, SERVED_AT));

    act(() => {
      result.current.moveCard(moveOf("a", ApplicationStatus.APPLIED, ApplicationStatus.OFFER));
    });
    await waitFor(() => expect(result.current.isCardBusy("a")).toBe(true));

    act(() => {
      result.current.moveCard(moveOf("b", ApplicationStatus.WISHLIST, ApplicationStatus.APPLIED));
    });
    await waitFor(() => expect(result.current.isCardBusy("b")).toBe(true));
    expect(result.current.isCardBusy("a")).toBe(true);

    // Settling the second write must not release the first.
    await act(async () => {
      settlers[1]?.({ ok: true, data: application("b", ApplicationStatus.APPLIED) });
    });
    expect(result.current.isCardBusy("b")).toBe(false);
    expect(result.current.isCardBusy("a")).toBe(true);

    await act(async () => {
      settlers[0]?.({ ok: true, data: application("a", ApplicationStatus.OFFER) });
    });
    expect(result.current.isCardBusy("a")).toBe(false);
  });

  it("drops the optimistic move and reports the failure when the write fails", async () => {
    const settlers = deferAction();
    const { result } = renderHook(() => useBoardCards(APPLICATIONS, SERVED_AT));

    act(() => {
      result.current.moveCard(moveOf("a", ApplicationStatus.APPLIED, ApplicationStatus.OFFER));
    });
    await waitFor(() => expect(result.current.isCardBusy("a")).toBe(true));

    await act(async () => {
      settlers[0]?.({ ok: false, error: "Application not found" });
    });

    expect(result.current.error).toBe("Application not found");
    expect(result.current.shown.find((item) => item.id === "a")?.status).toBe(
      ApplicationStatus.APPLIED,
    );
    expect(result.current.isCardBusy("a")).toBe(false);
  });

  it("clears an earlier failure when a new move starts", async () => {
    const settlers = deferAction();
    const { result } = renderHook(() => useBoardCards(APPLICATIONS, SERVED_AT));

    act(() => {
      result.current.moveCard(moveOf("a", ApplicationStatus.APPLIED, ApplicationStatus.OFFER));
    });
    await act(async () => {
      settlers[0]?.({ ok: false, error: "Application not found" });
    });
    expect(result.current.error).toBe("Application not found");

    act(() => {
      result.current.moveCard(moveOf("b", ApplicationStatus.WISHLIST, ApplicationStatus.APPLIED));
    });
    await waitFor(() => expect(result.current.error).toBeNull());

    await act(async () => {
      settlers[1]?.({ ok: true, data: application("b", ApplicationStatus.APPLIED) });
    });
  });

  it("calls the server action once per move, with the card and its new status", async () => {
    const settlers = deferAction();
    const { result } = renderHook(() => useBoardCards(APPLICATIONS, SERVED_AT));

    act(() => {
      result.current.moveCard(moveOf("a", ApplicationStatus.APPLIED, ApplicationStatus.OFFER));
    });
    await waitFor(() => expect(updateApplicationStatus).toHaveBeenCalledTimes(1));
    expect(updateApplicationStatus).toHaveBeenCalledWith("a", ApplicationStatus.OFFER);

    await act(async () => {
      settlers[0]?.({ ok: true, data: application("a", ApplicationStatus.OFFER) });
    });
  });
});

describe("useBoardCards when the write does not settle into a result", () => {
  it("releases the card and reports the failure", async () => {
    // The action is typed to return ActionResult, but nothing made that true:
    // updateApplicationStatus had no try/catch at all, so a locked database was
    // a rejection inside startTransition. React sends that to the nearest error
    // boundary, which is app/error.tsx, and the whole board goes. The card is
    // the half that survives even a recovery: pending is released on the line
    // after the await, which a rejection never reaches.
    updateApplicationStatus.mockRejectedValue(new Error("database is locked"));
    const { result } = renderHook(() => useBoardCards(APPLICATIONS, SERVED_AT));

    act(() => {
      result.current.moveCard(moveOf("a", ApplicationStatus.APPLIED, ApplicationStatus.OFFER));
    });

    await waitFor(() => expect(result.current.isCardBusy("a")).toBe(false));
    // The exact string, and the same constant the action returns, so the two
    // readers of it cannot drift apart.
    expect(result.current.error).toBe(FAILED.move);
    // The same assertion the ok:false test makes, because the requirement says
    // this case behaves "exactly as for a failure the storage does describe" -
    // and the card returning is the half of that a message does not prove.
    expect(result.current.shown.find((item) => item.id === "a")?.status).toBe(
      ApplicationStatus.APPLIED,
    );
  });

  // There is no third test here for "a card can be moved again after a failed
  // move". One was written and removed: moveCard has no pending guard, so a
  // second call reaches the action whether or not the card was released, and
  // toHaveBeenCalledTimes(2) held either way. The scenario is pinned in the two
  // places the behaviour actually lives - isCardBusy going back to false
  // above, and ApplicationCard enabling the handle when it does, which its own
  // tests cover.
});

describe("useBoardCards: deleting a card", () => {
  it("takes the card off the board before the server has confirmed it", async () => {
    const settlers = deferDeletion();
    const { result } = renderHook(() => useBoardCards(APPLICATIONS, SERVED_AT));

    act(() => {
      result.current.removeCard("a");
    });

    await waitFor(() => expect(idsOf(result.current.shown)).toEqual(["b"]));

    await act(async () => {
      settlers[0]?.({ ok: true, data: { id: "a" } });
    });
  });

  it("holds the card while its deletion is outstanding and releases it after", async () => {
    const settlers = deferDeletion();
    const { result } = renderHook(() => useBoardCards(APPLICATIONS, SERVED_AT));

    act(() => {
      result.current.removeCard("a");
    });
    await waitFor(() => expect(result.current.isCardBusy("a")).toBe(true));
    // The requirement is that one confirmation cannot become two writes, and
    // that the rest of the board is unaffected while it is in flight.
    expect(result.current.isCardBusy("b")).toBe(false);

    await act(async () => {
      settlers[0]?.({ ok: true, data: { id: "a" } });
    });
    expect(result.current.isCardBusy("a")).toBe(false);
  });

  it("puts the card back and reports the failure when the deletion fails", async () => {
    const settlers = deferDeletion();
    const { result } = renderHook(() => useBoardCards(APPLICATIONS, SERVED_AT));

    act(() => {
      result.current.removeCard("a");
    });
    await waitFor(() => expect(idsOf(result.current.shown)).toEqual(["b"]));

    await act(async () => {
      settlers[0]?.({ ok: false, error: FAILED.remove });
    });

    expect(result.current.error).toBe(FAILED.remove);
    // Still stored, so the card is the truthful thing to show.
    expect(idsOf(result.current.shown)).toEqual(["a", "b"]);
    expect(result.current.isCardBusy("a")).toBe(false);
  });

  it("reports a missing application and leaves the server list to decide", async () => {
    // The one failure where the optimistic removal was right: no column is the
    // truthful place for an application that is gone. The server list is what
    // puts it back, so the hook must not do it - and the action revalidates on
    // that branch, which is what makes the list arrive without a reload.
    const settlers = deferDeletion();
    const { result } = renderHook(() => useBoardCards(APPLICATIONS, SERVED_AT));

    act(() => {
      result.current.removeCard("a");
    });
    await act(async () => {
      settlers[0]?.({ ok: false, error: "Application not found" });
    });

    expect(result.current.error).toBe("Application not found");
    expect(idsOf(result.current.shown)).toEqual(["a", "b"]);
  });

  it("releases the card and reports the failure when the deletion rejects", async () => {
    deleteApplication.mockRejectedValue(new Error("database is locked"));
    const { result } = renderHook(() => useBoardCards(APPLICATIONS, SERVED_AT));

    act(() => {
      result.current.removeCard("a");
    });

    await waitFor(() => expect(result.current.isCardBusy("a")).toBe(false));
    expect(result.current.error).toBe(FAILED.remove);
    expect(idsOf(result.current.shown)).toEqual(["a", "b"]);
  });

  it("clears an earlier failure when a new deletion starts", async () => {
    const settlers = deferDeletion();
    const { result } = renderHook(() => useBoardCards(APPLICATIONS, SERVED_AT));

    act(() => {
      result.current.removeCard("a");
    });
    await act(async () => {
      settlers[0]?.({ ok: false, error: FAILED.remove });
    });
    expect(result.current.error).toBe(FAILED.remove);

    act(() => {
      result.current.removeCard("b");
    });
    await waitFor(() => expect(result.current.error).toBeNull());

    await act(async () => {
      settlers[1]?.({ ok: true, data: { id: "b" } });
    });
  });

  it("calls the server action once per deletion, with the card id", async () => {
    const settlers = deferDeletion();
    const { result } = renderHook(() => useBoardCards(APPLICATIONS, SERVED_AT));

    act(() => {
      result.current.removeCard("a");
    });
    await waitFor(() => expect(deleteApplication).toHaveBeenCalledTimes(1));
    expect(deleteApplication).toHaveBeenCalledWith("a");

    await act(async () => {
      settlers[0]?.({ ok: true, data: { id: "a" } });
    });
  });
});

describe("useBoardCards: a move and a deletion of the same card", () => {
  it("does not let the move resurrect a card the deletion has taken off", async () => {
    // Two useOptimistic calls over the same server list would give two answers
    // to "what does the board show" here. One reducer makes this a sequence of
    // changes over one list instead, so the later change wins whichever write
    // settles first.
    const moves = deferAction();
    const deletions = deferDeletion();
    const { result, rerender } = renderHook(
      ({ cards }: { cards: JobApplication[] }) => useBoardCards(cards, SERVED_AT),
      { initialProps: { cards: APPLICATIONS } },
    );

    act(() => {
      result.current.moveCard(moveOf("a", ApplicationStatus.APPLIED, ApplicationStatus.OFFER));
    });
    await waitFor(() => expect(result.current.isCardBusy("a")).toBe(true));

    act(() => {
      result.current.removeCard("a");
    });
    await waitFor(() => expect(idsOf(result.current.shown)).toEqual(["b"]));

    // The move settles while the deletion is still in flight. Its optimistic
    // change is the older of the two, so it must not put the card back.
    await act(async () => {
      moves[0]?.({ ok: true, data: application("a", ApplicationStatus.OFFER) });
    });
    expect(idsOf(result.current.shown)).toEqual(["b"]);

    // Then the deletion settles and the server list arrives without the row -
    // which is what revalidatePath on the action delivers in the real board.
    await act(async () => {
      deletions[0]?.({ ok: true, data: { id: "a" } });
    });
    rerender({ cards: [APPLICATIONS[1] as JobApplication] });

    expect(idsOf(result.current.shown)).toEqual(["b"]);
    expect(result.current.isCardBusy("a")).toBe(false);
    expect(result.current.error).toBeNull();
  });
});

describe("useBoardCards: the badge follows a move", () => {
  it("resets statusChangedAt with the optimistic move", async () => {
    // The move's write provably resets statusChangedAt - planStatusChange does
    // it on any real status change - so a card showing its old count in a new
    // column would be stating the one thing the board knows to be wrong.
    //
    // The served instant, not a fresh Date: a rendered number must not come
    // from the client clock, and the difference between the two is at most the
    // age of the page.
    const settlers = deferAction();
    const { result } = renderHook(() => useBoardCards(APPLICATIONS, SERVED_AT));

    act(() => {
      result.current.moveCard(moveOf("a", ApplicationStatus.APPLIED, ApplicationStatus.OFFER));
    });

    await waitFor(() => {
      const moved = result.current.shown.find((item) => item.id === "a");
      expect(moved?.status).toBe(ApplicationStatus.OFFER);
      expect(moved?.statusChangedAt).toEqual(SERVED_AT);
    });

    await act(async () => {
      settlers[0]?.({ ok: true, data: application("a", ApplicationStatus.OFFER) });
    });
  });

  it("leaves every other card's statusChangedAt alone", async () => {
    const settlers = deferAction();
    const { result } = renderHook(() => useBoardCards(APPLICATIONS, SERVED_AT));

    act(() => {
      result.current.moveCard(moveOf("a", ApplicationStatus.APPLIED, ApplicationStatus.OFFER));
    });
    await waitFor(() => expect(result.current.shown[0]?.statusChangedAt).toEqual(SERVED_AT));

    expect(result.current.shown.find((item) => item.id === "b")?.statusChangedAt).toEqual(
      TIMESTAMP,
    );

    await act(async () => {
      settlers[0]?.({ ok: true, data: application("a", ApplicationStatus.OFFER) });
    });
  });

  it("restores the original statusChangedAt when the move fails", async () => {
    // The optimistic change is dropped and the server list wins, which is the
    // same mechanism that already puts the card back in its column - so the
    // badge goes back with it and needs no handling of its own.
    const settlers = deferAction();
    const { result } = renderHook(() => useBoardCards(APPLICATIONS, SERVED_AT));

    act(() => {
      result.current.moveCard(moveOf("a", ApplicationStatus.APPLIED, ApplicationStatus.OFFER));
    });
    await waitFor(() => expect(result.current.shown[0]?.statusChangedAt).toEqual(SERVED_AT));

    await act(async () => {
      settlers[0]?.({ ok: false, error: FAILED.move });
    });

    const restored = result.current.shown.find((item) => item.id === "a");
    expect(restored?.status).toBe(ApplicationStatus.APPLIED);
    expect(restored?.statusChangedAt).toEqual(TIMESTAMP);
  });

  it("does not touch statusChangedAt when a card is deleted", async () => {
    // The merged reducer must not have picked up a second side effect: the
    // remove branch filters, it does not rewrite.
    const settlers = deferDeletion();
    const { result } = renderHook(() => useBoardCards(APPLICATIONS, SERVED_AT));

    act(() => {
      result.current.removeCard("a");
    });
    await waitFor(() => expect(idsOf(result.current.shown)).toEqual(["b"]));

    expect(result.current.shown[0]?.statusChangedAt).toEqual(TIMESTAMP);

    await act(async () => {
      settlers[0]?.({ ok: false, error: FAILED.remove });
    });
    // And unchanged on the card that comes back, too.
    expect(result.current.shown.find((item) => item.id === "a")?.statusChangedAt).toEqual(
      TIMESTAMP,
    );
  });
});

describe("the summary the board derives from a move", () => {
  // The move half of "the figures follow a card move or a deletion". It lives
  // here rather than at board level because a move needs real layout, which jsdom
  // does not have: `Board` computes summariseBoard(groupApplicationsByStatus(shown))
  // and `shown` is what this hook returns, so asserting it here asserts the same
  // value the board renders.
  const summaryOf = (cards: readonly JobApplication[]) =>
    summariseBoard(groupApplicationsByStatus(cards));

  it("shows the card in the counted set before the write settles", async () => {
    const settlers = deferAction();
    const { result } = renderHook(() => useBoardCards(APPLICATIONS, SERVED_AT));

    // One Applied, one Wishlist: nothing has reached interview yet.
    expect(summaryOf(result.current.shown).percentReachedInterview).toBe(0);

    act(() => {
      result.current.moveCard(moveOf("a", ApplicationStatus.APPLIED, ApplicationStatus.INTERVIEW));
    });

    await waitFor(() =>
      expect(summaryOf(result.current.shown).percentReachedInterview).toBe(50),
    );
    expect(summaryOf(result.current.shown).total).toBe(2);

    await act(async () => {
      settlers[0]?.({ ok: true, data: application("a", ApplicationStatus.INTERVIEW) });
    });
  });

  it("puts the figures back when the move fails", async () => {
    // Nothing restores them explicitly: the optimistic change is dropped and the
    // server list wins, which is the same mechanism that returns the card to its
    // column. The status was not stored, so the share was not either.
    const settlers = deferAction();
    const { result } = renderHook(() => useBoardCards(APPLICATIONS, SERVED_AT));

    act(() => {
      result.current.moveCard(moveOf("a", ApplicationStatus.APPLIED, ApplicationStatus.INTERVIEW));
    });
    await waitFor(() =>
      expect(summaryOf(result.current.shown).percentReachedInterview).toBe(50),
    );

    await act(async () => {
      settlers[0]?.({ ok: false, error: FAILED.move });
    });

    expect(summaryOf(result.current.shown).percentReachedInterview).toBe(0);
    expect(summaryOf(result.current.shown).total).toBe(2);
  });

  it("leaves both figures alone for a move between two uncounted columns", async () => {
    const settlers = deferAction();
    const { result } = renderHook(() => useBoardCards(APPLICATIONS, SERVED_AT));

    act(() => {
      result.current.moveCard(moveOf("b", ApplicationStatus.WISHLIST, ApplicationStatus.APPLIED));
    });
    await waitFor(() => expect(result.current.isCardBusy("b")).toBe(true));

    expect(summaryOf(result.current.shown).total).toBe(2);
    expect(summaryOf(result.current.shown).percentReachedInterview).toBe(0);

    await act(async () => {
      settlers[0]?.({ ok: true, data: application("b", ApplicationStatus.APPLIED) });
    });
  });
});
