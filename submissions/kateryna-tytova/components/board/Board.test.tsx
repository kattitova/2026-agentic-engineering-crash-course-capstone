// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { JobApplication } from "@/app/generated/prisma/client";
import { ApplicationStatus } from "@/app/generated/prisma/enums";
import { FAILED, type ActionResult } from "@/lib/applications/action-result";

const { deleteApplication, updateApplicationStatus, updateApplicationFromForm, createApplicationFromForm } =
  vi.hoisted(() => ({
    deleteApplication: vi.fn(),
    updateApplicationStatus: vi.fn(),
    updateApplicationFromForm: vi.fn(),
    createApplicationFromForm: vi.fn(),
  }));

vi.mock("@/app/actions/applications", () => ({
  deleteApplication,
  updateApplicationStatus,
  updateApplicationFromForm,
  createApplicationFromForm,
}));

const { Board } = await import("./Board");

const TIMESTAMP = new Date("2026-09-01T00:00:00.000Z");
/**
 * The instant the board was served. Passed explicitly in every render: the prop
 * is required precisely so a forgotten call site is a compile error rather than
 * a component quietly reaching for a clock.
 */
const NOW = TIMESTAMP;


function application(
  id: string,
  company: string,
  status: ApplicationStatus = ApplicationStatus.APPLIED,
): JobApplication {
  return {
    id,
    company,
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

const CARDS = [
  application("a", "Acme Cloud", ApplicationStatus.APPLIED),
  application("b", "Globex", ApplicationStatus.APPLIED),
  application("c", "Initech", ApplicationStatus.INTERVIEW),
];

// jsdom implements neither showModal() nor close(); dnd-kit's dragging needs
// real layout and is not exercised here. What is exercised is everything the
// delete path does without a pointer drag.
beforeEach(() => {
  for (const mock of [
    deleteApplication,
    updateApplicationStatus,
    updateApplicationFromForm,
    createApplicationFromForm,
  ]) {
    mock.mockReset();
  }

  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.open = false;
    this.dispatchEvent(new Event("close"));
  };
});

afterEach(cleanup);

/** Lets a test decide when — and how — each pending deletion settles. */
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

const cardNames = () =>
  screen.getAllByRole("article").map((card) => card.getAttribute("aria-label") ?? card.textContent);

/** The count a column announces, as assistive technology would read it. */
function countOf(column: string): string {
  const heading = screen.getByRole("heading", { name: column });
  const section = heading.closest("section");
  if (section === null) {
    throw new Error(`no section for ${column}`);
  }
  return section.querySelector(".sr-only")?.textContent ?? "";
}

async function confirmDeletionOf(company: string) {
  fireEvent.click(screen.getByRole("button", { name: `Delete ${company}` }));
  const confirm = await screen.findByRole("button", { name: /delete application/i });
  await act(async () => {
    fireEvent.click(confirm);
  });
}

describe("Board asking before it deletes", () => {
  it("deletes nothing when the delete control is activated", () => {
    render(<Board now={NOW} applications={CARDS} />);

    fireEvent.click(screen.getByRole("button", { name: "Delete Acme Cloud" }));

    expect(screen.getByRole("heading", { name: "Delete Acme Cloud?" })).toBeInTheDocument();
    expect(deleteApplication).not.toHaveBeenCalled();
    expect(screen.getByText("Acme Cloud")).toBeInTheDocument();
  });

  it("deletes nothing when the confirmation is declined", () => {
    render(<Board now={NOW} applications={CARDS} />);

    fireEvent.click(screen.getByRole("button", { name: "Delete Acme Cloud" }));
    fireEvent.click(screen.getByRole("button", { name: /keep it/i }));

    expect(deleteApplication).not.toHaveBeenCalled();
    expect(screen.getByText("Acme Cloud")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Delete Acme Cloud?" })).toBeNull();
  });

  it("names the application the control belongs to, not the first card", () => {
    render(<Board now={NOW} applications={CARDS} />);

    fireEvent.click(screen.getByRole("button", { name: "Delete Globex" }));

    expect(screen.getByRole("heading", { name: "Delete Globex?" })).toBeInTheDocument();
  });
});

describe("Board after a confirmed deletion", () => {
  it("takes the card off and drops that column's count before the write settles", async () => {
    // Asserted while the deletion is in flight, because that is when the
    // optimistic removal is the only thing holding the card off the board.
    // Once the transition settles the board renders from the server list again
    // - which is the next test.
    const settlers = deferDeletion();
    render(<Board now={NOW} applications={CARDS} />);

    expect(countOf("Applied")).toBe("2 applications");

    fireEvent.click(screen.getByRole("button", { name: "Delete Acme Cloud" }));
    await act(async () => {
      fireEvent.click(await screen.findByRole("button", { name: /delete application/i }));
    });

    await waitFor(() => expect(screen.queryByText("Acme Cloud")).toBeNull());
    expect(countOf("Applied")).toBe("1 application");
    expect(deleteApplication).toHaveBeenCalledWith("a");

    await act(async () => {
      settlers[0]?.({ ok: true, data: { id: "a" } });
    });
  });

  it("keeps the card off once the stored list arrives without it", async () => {
    // The server list is the truth, and revalidatePath on the action is what
    // delivers it. Re-rendering with the shorter list is that arriving.
    deleteApplication.mockResolvedValue({ ok: true, data: { id: "a" } });
    const { rerender } = render(<Board now={NOW} applications={CARDS} />);

    await confirmDeletionOf("Acme Cloud");
    rerender(<Board now={NOW} applications={CARDS.slice(1)} />);

    expect(screen.queryByText("Acme Cloud")).toBeNull();
    expect(screen.getByText("Globex")).toBeInTheDocument();
    expect(screen.getByText("Initech")).toBeInTheDocument();
    expect(countOf("Applied")).toBe("1 application");
    expect(countOf("Interview")).toBe("1 application");
    expect(cardNames()).toHaveLength(2);
  });

  it("closes the confirmation rather than leaving it naming a card that is gone", async () => {
    deleteApplication.mockResolvedValue({ ok: true, data: { id: "a" } });
    render(<Board now={NOW} applications={CARDS} />);

    await confirmDeletionOf("Acme Cloud");

    expect(screen.queryByRole("heading", { name: "Delete Acme Cloud?" })).toBeNull();
  });
});

describe("Board when a deletion fails", () => {
  it("shows the failure on the board and keeps the board itself", async () => {
    deleteApplication.mockResolvedValue({ ok: false, error: FAILED.remove });
    render(<Board now={NOW} applications={CARDS} />);

    await confirmDeletionOf("Acme Cloud");

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(FAILED.remove);
    // Assertive, because the card coming back is easy to miss.
    expect(alert).toHaveAttribute("aria-live", "assertive");
    // The board is still there, and so is the card, because the row still is.
    expect(screen.getByRole("heading", { name: "Applied" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Acme Cloud")).toBeInTheDocument());
  });

  it("reports a second failure rather than letting it read as the first", async () => {
    // One message region means a second failure has to visibly replace the
    // first, or the person is looking at a stale message about another card.
    const settlers = deferDeletion();
    render(<Board now={NOW} applications={CARDS} />);

    await confirmDeletionOf("Acme Cloud");
    await act(async () => {
      settlers[0]?.({ ok: false, error: FAILED.remove });
    });
    expect(await screen.findByRole("alert")).toHaveTextContent(FAILED.remove);

    await confirmDeletionOf("Globex");
    // Cleared the moment the second deletion starts, which is what makes the
    // next message an announcement rather than unchanged text.
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(""));

    await act(async () => {
      settlers[1]?.({ ok: false, error: "Application not found" });
    });
    expect(await screen.findByRole("alert")).toHaveTextContent("Application not found");
  });

  it("clears the message when a later deletion succeeds", async () => {
    const settlers = deferDeletion();
    render(<Board now={NOW} applications={CARDS} />);

    await confirmDeletionOf("Acme Cloud");
    await act(async () => {
      settlers[0]?.({ ok: false, error: FAILED.remove });
    });
    expect(await screen.findByRole("alert")).toHaveTextContent(FAILED.remove);

    await confirmDeletionOf("Globex");
    await act(async () => {
      settlers[1]?.({ ok: true, data: { id: "b" } });
    });

    expect(screen.getByRole("alert")).toHaveTextContent("");
  });

  it("lets the card be deleted again without a reload", async () => {
    deleteApplication.mockResolvedValue({ ok: false, error: FAILED.remove });
    render(<Board now={NOW} applications={CARDS} />);

    await confirmDeletionOf("Acme Cloud");
    await waitFor(() => expect(screen.getByText("Acme Cloud")).toBeInTheDocument());

    await confirmDeletionOf("Acme Cloud");

    expect(deleteApplication).toHaveBeenCalledTimes(2);
  });

  it("leaves the card movable again after a failed deletion", async () => {
    // The other half of "the card is usable again": the requirement says it can
    // be deleted again *and moved again*, and a released drag handle is what the
    // second half means.
    deleteApplication.mockResolvedValue({ ok: false, error: FAILED.remove });
    render(<Board now={NOW} applications={CARDS} />);

    await confirmDeletionOf("Acme Cloud");

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Move Acme Cloud" })).toBeEnabled(),
    );
  });
});

describe("Board opening an application for editing", () => {
  it("opens the form on the card whose control was activated", () => {
    render(<Board now={NOW} applications={CARDS} />);

    fireEvent.click(screen.getByRole("button", { name: "Edit Globex" }));

    expect(screen.getByRole("heading", { name: "Edit application" })).toBeInTheDocument();
    expect(screen.getByLabelText(/company/i)).toHaveValue("Globex");
  });

  it("changes nothing when the form is dismissed", () => {
    render(<Board now={NOW} applications={CARDS} />);

    fireEvent.click(screen.getByRole("button", { name: "Edit Globex" }));
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));

    expect(updateApplicationFromForm).not.toHaveBeenCalled();
    expect(screen.getByText("Globex")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Edit application" })).toBeNull();
  });

  it("leaves the card in its column when the edit is stored", async () => {
    updateApplicationFromForm.mockResolvedValue({
      ok: true,
      data: application("c", "Initech Holdings", ApplicationStatus.INTERVIEW),
    });
    render(<Board now={NOW} applications={CARDS} />);

    fireEvent.click(screen.getByRole("button", { name: "Edit Initech" }));
    fireEvent.change(screen.getByLabelText(/company/i), {
      target: { value: "Initech Holdings" },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /save changes/i }));
    });

    // The counts are what prove the edit did not move the card: the board still
    // renders from the server list, which this edit does not change.
    expect(countOf("Interview")).toBe("1 application");
    expect(countOf("Applied")).toBe("2 applications");
    expect(cardNames()).toHaveLength(3);
  });
});

describe("Board editing an application that no longer exists", () => {
  it("keeps the form open with the message when the row disappears under it", async () => {
    // The not-found branch of updateApplication revalidates the board, so the
    // row leaves `applications` in the same breath as the result arrives. If the
    // dialog's open state is derived from the row being present, that
    // revalidation unmounts the form and takes the message with it - leaving a
    // dialog that closes and a card that vanishes, which is indistinguishable
    // from a save that worked.
    updateApplicationFromForm.mockResolvedValue({ ok: false, error: "Application not found" });
    const { rerender } = render(<Board now={NOW} applications={CARDS} />);

    fireEvent.click(screen.getByRole("button", { name: "Edit Initech" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /save changes/i }));
    });

    // The revalidated list arrives without the row.
    rerender(<Board now={NOW} applications={CARDS.slice(0, 2)} />);

    expect(screen.getByRole("dialog", { name: "Edit application" })).toBeVisible();
    expect(screen.getByText("Application not found")).toBeInTheDocument();
    // And the card is gone, which is the other half of the requirement.
    expect(screen.queryByText("Initech")).toBeNull();
  });

  it("closes only when the person dismisses it", async () => {
    updateApplicationFromForm.mockResolvedValue({ ok: false, error: "Application not found" });
    const { rerender } = render(<Board now={NOW} applications={CARDS} />);

    fireEvent.click(screen.getByRole("button", { name: "Edit Initech" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /save changes/i }));
    });
    rerender(<Board now={NOW} applications={CARDS.slice(0, 2)} />);

    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));

    expect(screen.queryByRole("dialog", { name: "Edit application" })).toBeNull();
  });
});

describe("Board holding a deletion that is in flight", () => {
  it("offers no way to confirm the same deletion twice", async () => {
    // The requirement is that one confirmation cannot become two writes. It is
    // met structurally rather than by a disabled control: the confirmation is
    // closed before the write starts and the card is optimistically removed, so
    // neither control exists while the deletion is outstanding.
    const settlers = deferDeletion();
    render(<Board now={NOW} applications={CARDS} />);

    await confirmDeletionOf("Acme Cloud");

    expect(screen.queryByRole("heading", { name: "Delete Acme Cloud?" })).toBeNull();
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Delete Acme Cloud" })).toBeNull(),
    );
    expect(deleteApplication).toHaveBeenCalledTimes(1);

    // Every other card is still deletable while this one is in flight.
    expect(screen.getByRole("button", { name: "Delete Globex" })).toBeEnabled();

    await act(async () => {
      settlers[0]?.({ ok: true, data: { id: "a" } });
    });
  });
});

describe("Board counting every card against one instant", () => {
  const DAY = 24 * 60 * 60 * 1000;
  const SERVED = new Date(TIMESTAMP.getTime() + 12 * DAY);

  it("shows the same count for two cards whose statuses changed together", () => {
    // Asserted at the board rather than inferred from the prop: this is the
    // scenario "every card is counted against the same moment", and the board is
    // where several columns could have disagreed.
    render(<Board applications={CARDS} now={SERVED} />);

    // Two in Applied, one in Interview - all three measured from one instant.
    expect(screen.getAllByText("12 days in Applied")).toHaveLength(2);
    expect(screen.getByText("12 days in Interview")).toBeInTheDocument();
  });

  it("counts a card 12 days behind the instant as 12", () => {
    render(<Board applications={CARDS} now={SERVED} />);

    expect(screen.getAllByText("12d")).toHaveLength(3);
  });

  it("announces a moved card with the column it is now in", async () => {
    // The announced status is derived from where the card is, so a stale label
    // would be the badge contradicting its own column. The optimistic move also
    // resets the clock, so the moved card reads as today.
    const { rerender } = render(<Board applications={CARDS} now={SERVED} />);

    expect(screen.getByText("12 days in Interview")).toBeInTheDocument();

    // The move itself needs real layout, so the server list arriving with the
    // new status is what stands in for it here - which is also the state the
    // board settles into either way.
    rerender(
      <Board
        applications={[
          CARDS[0] as JobApplication,
          CARDS[1] as JobApplication,
          { ...(CARDS[2] as JobApplication), status: ApplicationStatus.OFFER, statusChangedAt: SERVED },
        ]}
        now={SERVED}
      />,
    );

    expect(screen.getByText("Today in Offer")).toBeInTheDocument();
    expect(screen.queryByText("12 days in Interview")).toBeNull();
  });
});

describe("Board flagging applications that have gone quiet", () => {
  const DAY = 24 * 60 * 60 * 1000;
  const SERVED = new Date(TIMESTAMP.getTime() + 30 * DAY);

  it("flags the Applied cards and not the Interview one", () => {
    render(<Board applications={CARDS} now={SERVED} />);

    // CARDS holds two in Applied and one in Interview, all 30 days behind.
    expect(screen.getAllByText("No movement")).toHaveLength(2);
    const interview = screen.getByText("Initech").closest("article");
    expect(interview).not.toContainElement(screen.getAllByText("No movement")[0] ?? null);
  });

  it("stops flagging a card once it is in another column", () => {
    // The status half of the rule. A move changes both fields the rule reads, so
    // the server list arriving with the new status is the state the board settles
    // into whichever way the move was made.
    const { rerender } = render(<Board applications={CARDS} now={SERVED} />);
    expect(screen.getAllByText("No movement")).toHaveLength(2);

    rerender(
      <Board
        applications={[
          { ...(CARDS[0] as JobApplication), status: ApplicationStatus.INTERVIEW },
          CARDS[1] as JobApplication,
          CARDS[2] as JobApplication,
        ]}
        now={SERVED}
      />,
    );

    expect(screen.getAllByText("No movement")).toHaveLength(1);
    const moved = screen.getByText("Acme Cloud").closest("article");
    expect(moved?.textContent).not.toContain("No movement");
  });

  it("does not flag a card that has just moved into Applied", () => {
    // The age half. A move resets statusChangedAt, so time in Applied starts at
    // the move however long the card sat in Wishlist first.
    render(
      <Board
        applications={[
          { ...(CARDS[0] as JobApplication), statusChangedAt: SERVED },
          { ...(CARDS[1] as JobApplication), statusChangedAt: SERVED },
          { ...(CARDS[2] as JobApplication), statusChangedAt: SERVED },
        ]}
        now={SERVED}
      />,
    );

    expect(screen.queryByText("No movement")).toBeNull();
  });
});
