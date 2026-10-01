// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { JobApplication } from "@/app/generated/prisma/client";
import { ApplicationStatus } from "@/app/generated/prisma/enums";
import { ConfirmDeleteDialog } from "./ConfirmDeleteDialog";

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

// jsdom implements neither showModal() nor close(). The focus trap, Escape and
// focus restoration are the browser's and are covered in the e2e run rather
// than reimplemented here; these stubs only keep `open` in step.
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

describe("ConfirmDeleteDialog", () => {
  it("names the application it is about to delete", () => {
    // Named rather than "Delete this application?": the person has to be able to
    // see which card they are about to lose, since nothing restores it.
    render(
      <ConfirmDeleteDialog
        application={application({ company: "Acme Cloud" })}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByRole("heading", { name: "Delete Acme Cloud?" })).toBeInTheDocument();
  });

  it("is announced with that name, and says the deletion is final", () => {
    render(
      <ConfirmDeleteDialog
        application={application()}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAccessibleName("Delete Acme Cloud?");
    expect(dialog).toHaveAccessibleDescription(/cannot be undone/i);
    // The role too, not only the text: a labelled <div> would read the same in
    // the DOM and announce as nothing in particular.
    expect(dialog).toBeInTheDocument();
  });

  it("deletes nothing until it is confirmed", () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmDeleteDialog application={application()} onConfirm={onConfirm} onCancel={vi.fn()} />,
    );

    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /delete application/i })).toBeInTheDocument();
  });

  it("hands the application back when it is confirmed", () => {
    const onConfirm = vi.fn();
    const card = application({ id: "app-9" });
    render(
      <ConfirmDeleteDialog application={card} onConfirm={onConfirm} onCancel={vi.fn()} />,
    );

    fireEvent.click(screen.getByRole("button", { name: /delete application/i }));

    expect(onConfirm).toHaveBeenCalledWith(card);
  });

  it("deletes nothing when it is declined", () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <ConfirmDeleteDialog application={application()} onConfirm={onConfirm} onCancel={onCancel} />,
    );

    fireEvent.click(screen.getByRole("button", { name: /keep it/i }));

    expect(onCancel).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("reports a dismissal the dialog itself performed", () => {
    // Escape and the backdrop close the dialog without going through the decline
    // button, so the state has to follow the dialog rather than the other way
    // round - otherwise the board thinks it is still confirming.
    const onCancel = vi.fn();
    render(
      <ConfirmDeleteDialog application={application()} onConfirm={vi.fn()} onCancel={onCancel} />,
    );

    screen.getByRole("dialog").dispatchEvent(new Event("close"));

    expect(onCancel).toHaveBeenCalled();
  });

  it("shows nothing while there is no application to delete", () => {
    render(
      <ConfirmDeleteDialog application={null} onConfirm={vi.fn()} onCancel={vi.fn()} />,
    );

    expect(screen.queryByRole("heading")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
