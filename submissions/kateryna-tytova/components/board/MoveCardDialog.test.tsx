// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { JobApplication } from "@/app/generated/prisma/client";
import { ApplicationStatus } from "@/app/generated/prisma/enums";
import { MoveCardDialog } from "./MoveCardDialog";

const TIMESTAMP = new Date("2026-09-01T00:00:00.000Z");

function application(overrides: Partial<JobApplication> = {}): JobApplication {
  return {
    id: "app-1",
    company: "Acme Cloud",
    position: "Frontend Engineer",
    status: ApplicationStatus.APPLIED,
    link: null,
    notes: null,
    appliedDate: null,
    statusChangedAt: TIMESTAMP,
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
    ...overrides,
  };
}

// jsdom implements neither showModal() nor close(), so these stubs only keep
// `open` in step. That is the whole of what this file can say about the dialog's
// own behaviour: Escape, the inert background and focus restoration are the
// browser's, and are covered in e2e/move-by-menu.spec.ts, which is the only place
// a dialog opened with show() in place of showModal() would be caught.
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.open = false;
    this.dispatchEvent(new Event("close"));
  };
});

afterEach(cleanup);

function offered(): string[] {
  const dialog = screen.getByRole("dialog");
  return within(dialog)
    .getAllByRole("button")
    .map((button) => button.textContent ?? "")
    .filter((label) => label !== "Cancel");
}

describe("MoveCardDialog", () => {
  it("names the application it is about to move", () => {
    render(
      <MoveCardDialog
        application={application({ company: "Acme Cloud" })}
        onChoose={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByRole("heading", { name: "Move Acme Cloud to…" })).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toHaveAccessibleName("Move Acme Cloud to…");
  });

  it("offers the four other columns, in funnel order", () => {
    render(
      <MoveCardDialog
        application={application({ status: ApplicationStatus.APPLIED })}
        onChoose={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(offered()).toEqual(["Wishlist", "Interview", "Offer", "Rejected"]);
  });

  it("shows the current column as text and does not offer it", () => {
    render(
      <MoveCardDialog
        application={application({ status: ApplicationStatus.INTERVIEW })}
        onChoose={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByText("Currently in Interview.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Interview" })).not.toBeInTheDocument();
  });

  it("is described by the column the card is in now", () => {
    // Focus lands on the first choice, so the description is what announces where
    // the card is. Without it the fact is in the DOM and outside what is read out.
    render(
      <MoveCardDialog
        application={application({ status: ApplicationStatus.INTERVIEW })}
        onChoose={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByRole("dialog")).toHaveAccessibleDescription("Currently in Interview.");
  });

  it("hands the chosen column back with the application, and does not cancel", () => {
    const onChoose = vi.fn();
    const onCancel = vi.fn();
    const target = application({ status: ApplicationStatus.APPLIED });
    render(<MoveCardDialog application={target} onChoose={onChoose} onCancel={onCancel} />);

    fireEvent.click(screen.getByRole("button", { name: "Offer" }));

    expect(onChoose).toHaveBeenCalledTimes(1);
    expect(onChoose).toHaveBeenCalledWith(target, ApplicationStatus.OFFER);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("moves nothing until a column is chosen", () => {
    const onChoose = vi.fn();
    render(<MoveCardDialog application={application()} onChoose={onChoose} onCancel={vi.fn()} />);

    expect(onChoose).not.toHaveBeenCalled();
  });

  it("cancels without choosing when it is dismissed with the button", () => {
    const onChoose = vi.fn();
    const onCancel = vi.fn();
    render(<MoveCardDialog application={application()} onChoose={onChoose} onCancel={onCancel} />);

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onChoose).not.toHaveBeenCalled();
  });

  it("renders no choices while closed, so it never names a dismissed card", () => {
    render(<MoveCardDialog application={null} onChoose={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("offers every other column whatever the card's status is", () => {
    for (const status of Object.values(ApplicationStatus)) {
      const { unmount } = render(
        <MoveCardDialog
          application={application({ status })}
          onChoose={vi.fn()}
          onCancel={vi.fn()}
        />,
      );
      expect(offered()).toHaveLength(4);
      unmount();
    }
  });
});
