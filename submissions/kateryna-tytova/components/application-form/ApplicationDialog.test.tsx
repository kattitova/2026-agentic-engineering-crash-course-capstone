// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { JobApplication } from "@/app/generated/prisma/client";
import { ApplicationStatus } from "@/app/generated/prisma/enums";

const { createApplicationFromForm, updateApplicationFromForm } = vi.hoisted(() => ({
  createApplicationFromForm: vi.fn(),
  updateApplicationFromForm: vi.fn(),
}));

// The dialog imports the server actions directly, which would pull Prisma into
// jsdom. The form takes its action as a prop precisely so this is the only
// place that has to be mocked.
vi.mock("@/app/actions/applications", () => ({
  createApplicationFromForm,
  updateApplicationFromForm,
}));

const { ApplicationDialog } = await import("./ApplicationDialog");

// jsdom implements neither showModal() nor close(), so the dialog would never
// report itself open and the form would render once and stay. Both are stubbed
// to keep `open` in step; the focus trap and Escape are the browser's and are
// covered in the e2e run instead, not reimplemented here.
beforeEach(() => {
  createApplicationFromForm.mockReset();
  updateApplicationFromForm.mockReset();

  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.open = false;
    this.dispatchEvent(new Event("close"));
  };
});

afterEach(cleanup);

const TIMESTAMP = new Date("2026-09-01T00:00:00.000Z");

function application(overrides: Partial<JobApplication> = {}): JobApplication {
  return {
    id: "app-1",
    company: "Acme Cloud",
    position: "Frontend Engineer",
    status: ApplicationStatus.INTERVIEW,
    link: "https://jobs.example.com/42",
    notes: "Referred by Sam",
    appliedDate: null,
    statusChangedAt: TIMESTAMP,
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
    ...overrides,
  };
}

describe("ApplicationDialog adding an application", () => {
  it("shows the add heading and the add control", () => {
    render(<ApplicationDialog open onClose={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "Add application" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add application/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /save changes/i })).not.toBeInTheDocument();
  });

  it("renders no form while it is closed", () => {
    render(<ApplicationDialog open={false} onClose={vi.fn()} />);

    expect(screen.queryByLabelText(/company/i)).not.toBeInTheDocument();
  });
});

describe("ApplicationDialog opened on an application", () => {
  it("shows the edit heading and the stored values", () => {
    render(<ApplicationDialog open application={application()} onClose={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "Edit application" })).toBeInTheDocument();
    expect(screen.getByLabelText(/company/i)).toHaveValue("Acme Cloud");
    expect(screen.getByLabelText(/position/i)).toHaveValue("Frontend Engineer");
    expect(screen.getByLabelText(/link/i)).toHaveValue("https://jobs.example.com/42");
    expect(screen.getByLabelText(/notes/i)).toHaveValue("Referred by Sam");
  });

  it("maps a stored null to an empty field, not to the text null", () => {
    render(
      <ApplicationDialog
        open
        application={application({ link: null, notes: null })}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByLabelText(/link/i)).toHaveValue("");
    expect(screen.getByLabelText(/notes/i)).toHaveValue("");
  });

  it("sends the edit to updateApplicationFromForm with the application's id", async () => {
    updateApplicationFromForm.mockResolvedValue({ ok: true, data: application() });
    render(<ApplicationDialog open application={application()} onClose={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/company/i), { target: { value: "Acme Cloud GmbH" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /save changes/i }));
    });

    expect(updateApplicationFromForm).toHaveBeenCalledTimes(1);
    const [, formData] = updateApplicationFromForm.mock.calls[0] as [unknown, FormData];
    expect(formData.get("id")).toBe("app-1");
    expect(formData.get("company")).toBe("Acme Cloud GmbH");
    expect(createApplicationFromForm).not.toHaveBeenCalled();
  });

  it("closes once the edit is stored", async () => {
    updateApplicationFromForm.mockResolvedValue({ ok: true, data: application() });
    const onClose = vi.fn();
    render(<ApplicationDialog open application={application()} onClose={onClose} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /save changes/i }));
    });

    expect(onClose).toHaveBeenCalled();
  });

  it("stays open and writes nothing when the edit is refused", async () => {
    updateApplicationFromForm.mockResolvedValue({
      ok: false,
      error: "Invalid application data",
      fieldErrors: { company: "Company is required" },
    });
    const onClose = vi.fn();
    render(<ApplicationDialog open application={application()} onClose={onClose} />);

    fireEvent.change(screen.getByLabelText(/company/i), { target: { value: "   " } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /save changes/i }));
    });

    expect(onClose).not.toHaveBeenCalled();
    expect(await screen.findByLabelText(/company/i)).toHaveAccessibleDescription(
      "Company is required",
    );
  });

  it("asks nothing of the server when it is dismissed", () => {
    const onClose = vi.fn();
    render(<ApplicationDialog open application={application()} onClose={onClose} />);

    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));

    expect(onClose).toHaveBeenCalled();
    expect(updateApplicationFromForm).not.toHaveBeenCalled();
  });

  it("shows none of the first application's values when opened on a second", () => {
    // The defect this guards: React keeps a component's state across a prop
    // change, so without a key the form would still be holding the first
    // application's values - and the person would edit one application into
    // another's data.
    const { rerender } = render(
      <ApplicationDialog open application={application()} onClose={vi.fn()} />,
    );
    expect(screen.getByLabelText(/company/i)).toHaveValue("Acme Cloud");

    rerender(
      <ApplicationDialog
        open
        application={application({ id: "app-2", company: "Globex", position: "SRE", notes: null })}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByLabelText(/company/i)).toHaveValue("Globex");
    expect(screen.getByLabelText(/position/i)).toHaveValue("SRE");
    expect(screen.getByLabelText(/notes/i)).toHaveValue("");
  });

  it("starts clean when closed and reopened on the same application", () => {
    const { rerender } = render(
      <ApplicationDialog open application={application()} onClose={vi.fn()} />,
    );
    fireEvent.change(screen.getByLabelText(/company/i), { target: { value: "half-typed" } });

    rerender(<ApplicationDialog open={false} application={application()} onClose={vi.fn()} />);
    rerender(<ApplicationDialog open application={application()} onClose={vi.fn()} />);

    expect(screen.getByLabelText(/company/i)).toHaveValue("Acme Cloud");
  });
});
