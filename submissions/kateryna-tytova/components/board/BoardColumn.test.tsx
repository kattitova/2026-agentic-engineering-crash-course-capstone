// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { JobApplication } from "@/app/generated/prisma/client";
import { BOARD_COLUMNS } from "@/lib/applications/board";
import { BoardColumn } from "./BoardColumn";

const TIMESTAMP = new Date("2026-09-01T00:00:00.000Z");
/**
 * The instant the board was served. Passed explicitly in every render: the prop
 * is required precisely so a forgotten call site is a compile error rather than
 * a component quietly reaching for a clock.
 */
const NOW = TIMESTAMP;


const [, APPLIED_COLUMN] = BOARD_COLUMNS;

function application(id: string, overrides: Partial<JobApplication> = {}): JobApplication {
  return {
    id,
    company: `Company ${id}`,
    position: "Developer",
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

describe("BoardColumn", () => {
  it("announces the count as a number of applications, not a bare digit", () => {
    // Asserts announced text, not an attribute: an aria-label on the badge's bare
    // <span> sits on ARIA's name-prohibited `generic` role, so it passed a
    // getByLabelText check while remaining unreliable for a screen reader.
    render(
      <BoardColumn now={NOW}
        column={APPLIED_COLUMN}
        applications={[application("a"), application("b"), application("c")]}
      />,
    );

    expect(screen.getByText("3 applications")).toBeInTheDocument();
    // The visible digit is hidden from the tree, so the count is announced once.
    expect(screen.getByText("3")).toHaveAttribute("aria-hidden", "true");
  });

  it("names the column as a region so it can be reached as a landmark", () => {
    render(<BoardColumn now={NOW} column={APPLIED_COLUMN} applications={[]} />);

    expect(screen.getByRole("region", { name: "Applied" })).toBeInTheDocument();
  });

  it("uses the singular for one application", () => {
    render(<BoardColumn now={NOW} column={APPLIED_COLUMN} applications={[application("a")]} />);

    expect(screen.getByText("1 application")).toBeInTheDocument();
  });

  // The four tests below protect requirements that already hold. There is no red
  // step; each is proved non-vacuous by mutation, recorded in tasks 5.1-5.4.

  it("shows the number of applications it holds", () => {
    render(
      <BoardColumn now={NOW}
        column={APPLIED_COLUMN}
        applications={[application("a"), application("b"), application("c")]}
      />,
    );

    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("shows the count 0 when it holds nothing", () => {
    render(<BoardColumn now={NOW} column={APPLIED_COLUMN} applications={[]} />);

    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("explains that an empty column is empty instead of leaving it blank", () => {
    const { container } = render(<BoardColumn now={NOW} column={APPLIED_COLUMN} applications={[]} />);

    expect(screen.getByText(/no applications yet/i)).toBeInTheDocument();
    expect(container.querySelectorAll("article")).toHaveLength(0);
  });

  it("renders one card per application", () => {
    const { container } = render(
      <BoardColumn now={NOW} column={APPLIED_COLUMN} applications={[application("a"), application("b")]} />,
    );

    expect(container.querySelectorAll("article")).toHaveLength(2);
    expect(screen.queryByText(/no applications yet/i)).toBeNull();
  });
});

describe("BoardColumn passing the per-card controls down", () => {
  const CARDS = [
    application("a", { company: "Acme Cloud" }),
    application("b", { company: "Globex" }),
  ];

  it("gives every card its own edit and delete controls", () => {
    render(
      <BoardColumn now={NOW}
        column={APPLIED_COLUMN}
        applications={CARDS}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    for (const name of ["Edit Acme Cloud", "Delete Acme Cloud", "Edit Globex", "Delete Globex"]) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    }
  });

  it("calls back with the application whose control was activated", () => {
    // The defect this guards: one callback shared by every card in the column,
    // closed over the wrong application, deletes somebody else's card.
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    render(
      <BoardColumn now={NOW}
        column={APPLIED_COLUMN}
        applications={CARDS}
        onEdit={onEdit}
        onDelete={onDelete}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit Globex" }));
    expect(onEdit).toHaveBeenCalledWith(CARDS[1]);

    fireEvent.click(screen.getByRole("button", { name: "Delete Acme Cloud" }));
    expect(onDelete).toHaveBeenCalledWith(CARDS[0]);
  });

  it("renders no such controls when the column is given none", () => {
    render(<BoardColumn now={NOW} column={APPLIED_COLUMN} applications={CARDS} />);

    expect(screen.queryByRole("button", { name: /^Edit/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Delete/ })).toBeNull();
  });
});

describe("BoardColumn passing the served instant down", () => {
  const DAY = 24 * 60 * 60 * 1000;

  it("counts every card it renders against the same instant", () => {
    // Two cards whose statuses changed at the same moment must agree. If the
    // column handed each card a different instant - or let a card find its own -
    // these two numbers could differ.
    const cards = [
      application("a", { company: "Acme Cloud" }),
      application("b", { company: "Globex" }),
    ];

    render(
      <BoardColumn
        column={APPLIED_COLUMN}
        applications={cards}
        now={new Date(TIMESTAMP.getTime() + 12 * DAY)}
      />,
    );

    expect(screen.getAllByText("12 days in Applied")).toHaveLength(2);
  });

  it("gives each card exactly one badge", () => {
    const cards = [application("a"), application("b"), application("c")];

    render(
      <BoardColumn
        column={APPLIED_COLUMN}
        applications={cards}
        now={new Date(TIMESTAMP.getTime() + 3 * DAY)}
      />,
    );

    expect(screen.getAllByText(/days in Applied/)).toHaveLength(3);
    expect(screen.getAllByRole("article")).toHaveLength(3);
  });

  it("counts cards with different moments differently", () => {
    // The other half: one instant, not one answer.
    const cards = [
      application("a", { statusChangedAt: TIMESTAMP }),
      application("b", { statusChangedAt: new Date(TIMESTAMP.getTime() + 10 * DAY) }),
    ];

    render(
      <BoardColumn
        column={APPLIED_COLUMN}
        applications={cards}
        now={new Date(TIMESTAMP.getTime() + 12 * DAY)}
      />,
    );

    expect(screen.getByText("12 days in Applied")).toBeInTheDocument();
    expect(screen.getByText("2 days in Applied")).toBeInTheDocument();
  });
});

describe("BoardColumn flagging only the cards that have gone quiet", () => {
  const DAY = 24 * 60 * 60 * 1000;

  it("flags exactly one of a stale and a fresh Applied card", () => {
    // The rule is per card, not per column: a column holding both must flag one.
    const cards = [
      application("a", { company: "Acme Cloud", statusChangedAt: TIMESTAMP }),
      application("b", {
        company: "Globex",
        statusChangedAt: new Date(TIMESTAMP.getTime() + 25 * DAY),
      }),
    ];

    render(
      <BoardColumn
        column={APPLIED_COLUMN}
        applications={cards}
        now={new Date(TIMESTAMP.getTime() + 30 * DAY)}
      />,
    );

    expect(screen.getAllByText("No movement")).toHaveLength(1);
    // And it is the older one: 30 days versus 5.
    const stale = screen.getByText("30 days in Applied").closest("article");
    expect(stale).toContainElement(screen.getByText("No movement"));
  });

  it("flags none of them when the column is not Applied", () => {
    const cards = [application("a"), application("b")];

    render(
      <BoardColumn
        column={BOARD_COLUMNS[0] as typeof APPLIED_COLUMN}
        applications={cards.map((card) => ({ ...card, status: "WISHLIST" as const }))}
        now={new Date(TIMESTAMP.getTime() + 200 * DAY)}
      />,
    );

    expect(screen.queryByText("No movement")).toBeNull();
  });
});
