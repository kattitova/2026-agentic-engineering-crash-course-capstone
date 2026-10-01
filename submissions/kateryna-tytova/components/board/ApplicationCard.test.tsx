// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { JobApplication } from "@/app/generated/prisma/client";
import { ApplicationCard } from "./ApplicationCard";

const TIMESTAMP = new Date("2026-09-01T00:00:00.000Z");

function application(overrides: Partial<JobApplication> = {}): JobApplication {
  return {
    id: "a",
    company: "Acme Cloud",
    position: "Frontend Engineer",
    status: "APPLIED",
    link: null,
    notes: null,
    appliedDate: null,
    statusChangedAt: TIMESTAMP,
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
    ...overrides,
  };
}

// The config deliberately has no `globals: true`, so RTL's automatic cleanup
// never registers itself. Without this, renders pile up in one document.
afterEach(cleanup);

describe("ApplicationCard", () => {
  it("offers no link when the stored value is not an http address", () => {
    // seed.ts and direct database edits bypass validateApplicationInput, so the
    // render path cannot assume the stored scheme was ever checked.
    render(<ApplicationCard application={application({ link: "javascript:alert(1)" })} />);

    expect(screen.queryByRole("link")).toBeNull();
  });

  it("names the application in the posting link's accessible name", () => {
    // A column of cards otherwise reads as "View posting" over and over in a
    // screen reader's link list, with nothing to tell the entries apart.
    render(
      <ApplicationCard
        application={application({ company: "Acme Cloud", link: "https://acme.test/job" })}
      />,
    );

    expect(screen.getByRole("link")).toHaveAccessibleName(/Acme Cloud/);
  });

  it("shows a very long value in full rather than truncating the stored text", () => {
    // Only the clause jsdom can check. The geometry half of this requirement -
    // that the value changes no column's width and does not overflow the page -
    // is measured in e2e/long-value-layout.spec.ts, where layout exists. The
    // class assertions that used to stand in for it were removed: they could not
    // fail for any reason the spec cares about, and they read as evidence.
    const long = "A".repeat(200);
    render(<ApplicationCard application={application({ company: long, position: long })} />);

    expect(screen.getByText(long, { selector: "h3" })).toBeInTheDocument();
    expect(screen.getByText(long, { selector: "p" })).toBeInTheDocument();
  });

  // The two tests below protect requirements that already hold. There is no red
  // step; each is proved non-vacuous by mutation, recorded in tasks 5.3-5.4.

  it("shows both the company and the position", () => {
    render(<ApplicationCard application={application()} />);

    expect(screen.getByText("Acme Cloud")).toBeInTheDocument();
    expect(screen.getByText("Frontend Engineer")).toBeInTheDocument();
  });

  it("offers a link only when one is stored", () => {
    const { unmount } = render(<ApplicationCard application={application({ link: null })} />);
    expect(screen.queryByRole("link")).toBeNull();
    unmount();

    render(<ApplicationCard application={application({ link: "https://acme.test/job" })} />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "https://acme.test/job");
  });

  it("names the card after its company so navigation says where it is", () => {
    render(<ApplicationCard application={application()} />);

    expect(screen.getByRole("article", { name: "Acme Cloud" })).toBeInTheDocument();
  });

  it("offers a move control named after its application", () => {
    // Without the company in the name, a board of handles is "Move application"
    // repeated once per card.
    render(<ApplicationCard application={application()} />);

    expect(
      screen.getByRole("button", { name: /move Acme Cloud/i }),
    ).toBeInTheDocument();
  });

  it("disables the move control while that card's move is being stored", () => {
    render(<ApplicationCard application={application()} isMovePending />);

    expect(screen.getByRole("button", { name: /move Acme Cloud/i })).toBeDisabled();
  });

  it("leaves the move control enabled when no move is in flight", () => {
    render(<ApplicationCard application={application()} />);

    expect(screen.getByRole("button", { name: /move Acme Cloud/i })).toBeEnabled();
  });

  it("says the posting link opens a new tab", () => {
    render(<ApplicationCard application={application({ link: "https://acme.test/job" })} />);

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAccessibleName(/opens in a new tab/i);
  });
});

describe("ApplicationCard's edit and delete controls", () => {
  it("offers both, named after the application", () => {
    render(
      <ApplicationCard
        application={application({ company: "Acme Cloud" })}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    // Named rather than "Edit" and "Delete": a column of cards otherwise offers
    // the same two control names over and over, with nothing to tell them apart.
    expect(screen.getByRole("button", { name: "Edit Acme Cloud" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete Acme Cloud" })).toBeInTheDocument();
  });

  it("calls back with its own application", () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    const card = application({ id: "b", company: "Globex" });
    render(<ApplicationCard application={card} onEdit={onEdit} onDelete={onDelete} />);

    fireEvent.click(screen.getByRole("button", { name: "Edit Globex" }));
    expect(onEdit).toHaveBeenCalledWith(card);

    fireEvent.click(screen.getByRole("button", { name: "Delete Globex" }));
    expect(onDelete).toHaveBeenCalledWith(card);
  });

  it("does not fire the drag handle's listeners", () => {
    // The controls sit in the same row as the handle, and dnd-kit's listeners
    // are pointer-event handlers. If either control were inside the handle - or
    // the handle wrapped the row - activating one would start a drag.
    const onPointerDown = vi.fn();
    const onKeyDown = vi.fn();
    render(
      <ApplicationCard
        application={application({ company: "Acme Cloud" })}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        dragHandle={{
          attributes: {} as never,
          listeners: { onPointerDown, onKeyDown },
        }}
      />,
    );

    fireEvent.pointerDown(screen.getByRole("button", { name: "Edit Acme Cloud" }));
    fireEvent.pointerDown(screen.getByRole("button", { name: "Delete Acme Cloud" }));
    fireEvent.keyDown(screen.getByRole("button", { name: "Edit Acme Cloud" }), { key: " " });

    expect(onPointerDown).not.toHaveBeenCalled();
    expect(onKeyDown).not.toHaveBeenCalled();
  });

  it("stays usable while that card's move is being stored", () => {
    // Only the handle is held during a move: the person can still correct a typo
    // or give up on the application while its status write is outstanding.
    render(
      <ApplicationCard
        application={application({ company: "Acme Cloud" })}
        isMovePending
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Move Acme Cloud" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Edit Acme Cloud" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Delete Acme Cloud" })).toBeEnabled();
  });

  it("offers neither when the card is rendered without them", () => {
    // How the card is rendered outside a DndContext, and how BoardColumn renders
    // it in its own tests.
    render(<ApplicationCard application={application({ company: "Acme Cloud" })} />);

    expect(screen.queryByRole("button", { name: /^Edit/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Delete/ })).toBeNull();
  });

  it("offers a card with a link exactly four controls, counting the link", () => {
    // Counted, so a fourth button added to the header has to fail here.
    render(
      <ApplicationCard
        application={application({ company: "Acme Cloud", link: "https://acme.test/job" })}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getAllByRole("button")).toHaveLength(3);
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });
});

describe("ApplicationCard after an optional value was cleared", () => {
  it("offers no posting link while still offering both controls", () => {
    // The one scenario where an edit changes what the card renders: clearing the
    // link stores null, and the card must drop the control rather than offer an
    // empty href.
    render(
      <ApplicationCard
        application={application({ company: "Acme Cloud", link: null })}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByRole("button", { name: "Edit Acme Cloud" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete Acme Cloud" })).toBeInTheDocument();
  });
});
