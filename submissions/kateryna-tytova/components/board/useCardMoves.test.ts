// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { JobApplication } from "@/app/generated/prisma/client";
import { ApplicationStatus } from "@/app/generated/prisma/enums";
import type { ActionResult } from "@/lib/applications/action-result";
import type { CardMove } from "@/lib/applications/move";
import { useCardMoves } from "./useCardMoves";

const { updateApplicationStatus } = vi.hoisted(() => ({
  updateApplicationStatus: vi.fn(),
}));

vi.mock("@/app/actions/applications", () => ({ updateApplicationStatus }));

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
function deferAction() {
  const settlers: ((result: ActionResult<JobApplication>) => void)[] = [];
  updateApplicationStatus.mockImplementation(
    () =>
      new Promise<ActionResult<JobApplication>>((resolve) => {
        settlers.push(resolve);
      }),
  );
  return settlers;
}

beforeEach(() => {
  updateApplicationStatus.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useCardMoves", () => {
  it("shows the move before the server has confirmed it", async () => {
    const settlers = deferAction();
    const { result } = renderHook(() => useCardMoves(APPLICATIONS));

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
    const { result } = renderHook(() => useCardMoves(APPLICATIONS));

    act(() => {
      result.current.moveCard(moveOf("a", ApplicationStatus.APPLIED, ApplicationStatus.OFFER));
    });
    await waitFor(() => expect(result.current.isMovePending("a")).toBe(true));

    await act(async () => {
      settlers[0]?.({ ok: true, data: application("a", ApplicationStatus.OFFER) });
    });
    expect(result.current.isMovePending("a")).toBe(false);
  });

  it("keeps a first card held when a second card is moved before it settles", async () => {
    // The defect this exists to prevent: one pending id instead of a set lets a
    // second drag re-enable the first card's handle while its write is still
    // outstanding, which is exactly the ordering the spec forbids.
    const settlers = deferAction();
    const { result } = renderHook(() => useCardMoves(APPLICATIONS));

    act(() => {
      result.current.moveCard(moveOf("a", ApplicationStatus.APPLIED, ApplicationStatus.OFFER));
    });
    await waitFor(() => expect(result.current.isMovePending("a")).toBe(true));

    act(() => {
      result.current.moveCard(moveOf("b", ApplicationStatus.WISHLIST, ApplicationStatus.APPLIED));
    });
    await waitFor(() => expect(result.current.isMovePending("b")).toBe(true));
    expect(result.current.isMovePending("a")).toBe(true);

    // Settling the second write must not release the first.
    await act(async () => {
      settlers[1]?.({ ok: true, data: application("b", ApplicationStatus.APPLIED) });
    });
    expect(result.current.isMovePending("b")).toBe(false);
    expect(result.current.isMovePending("a")).toBe(true);

    await act(async () => {
      settlers[0]?.({ ok: true, data: application("a", ApplicationStatus.OFFER) });
    });
    expect(result.current.isMovePending("a")).toBe(false);
  });

  it("drops the optimistic move and reports the failure when the write fails", async () => {
    const settlers = deferAction();
    const { result } = renderHook(() => useCardMoves(APPLICATIONS));

    act(() => {
      result.current.moveCard(moveOf("a", ApplicationStatus.APPLIED, ApplicationStatus.OFFER));
    });
    await waitFor(() => expect(result.current.isMovePending("a")).toBe(true));

    await act(async () => {
      settlers[0]?.({ ok: false, error: "Application not found" });
    });

    expect(result.current.error).toBe("Application not found");
    expect(result.current.shown.find((item) => item.id === "a")?.status).toBe(
      ApplicationStatus.APPLIED,
    );
    expect(result.current.isMovePending("a")).toBe(false);
  });

  it("clears an earlier failure when a new move starts", async () => {
    const settlers = deferAction();
    const { result } = renderHook(() => useCardMoves(APPLICATIONS));

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
    const { result } = renderHook(() => useCardMoves(APPLICATIONS));

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
