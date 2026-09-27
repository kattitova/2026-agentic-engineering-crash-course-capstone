// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { JobApplication } from "@/app/generated/prisma/client";
import { BOARD_COLUMNS } from "@/lib/applications/board";
import { BoardColumn } from "./BoardColumn";

const TIMESTAMP = new Date("2026-09-01T00:00:00.000Z");

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
      <BoardColumn
        column={APPLIED_COLUMN}
        applications={[application("a"), application("b"), application("c")]}
      />,
    );

    expect(screen.getByText("3 applications")).toBeInTheDocument();
    // The visible digit is hidden from the tree, so the count is announced once.
    expect(screen.getByText("3")).toHaveAttribute("aria-hidden", "true");
  });

  it("names the column as a region so it can be reached as a landmark", () => {
    render(<BoardColumn column={APPLIED_COLUMN} applications={[]} />);

    expect(screen.getByRole("region", { name: "Applied" })).toBeInTheDocument();
  });

  it("uses the singular for one application", () => {
    render(<BoardColumn column={APPLIED_COLUMN} applications={[application("a")]} />);

    expect(screen.getByText("1 application")).toBeInTheDocument();
  });

  // The four tests below protect requirements that already hold. There is no red
  // step; each is proved non-vacuous by mutation, recorded in tasks 5.1-5.4.

  it("shows the number of applications it holds", () => {
    render(
      <BoardColumn
        column={APPLIED_COLUMN}
        applications={[application("a"), application("b"), application("c")]}
      />,
    );

    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("shows the count 0 when it holds nothing", () => {
    render(<BoardColumn column={APPLIED_COLUMN} applications={[]} />);

    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("explains that an empty column is empty instead of leaving it blank", () => {
    const { container } = render(<BoardColumn column={APPLIED_COLUMN} applications={[]} />);

    expect(screen.getByText(/no applications yet/i)).toBeInTheDocument();
    expect(container.querySelectorAll("article")).toHaveLength(0);
  });

  it("renders one card per application", () => {
    const { container } = render(
      <BoardColumn column={APPLIED_COLUMN} applications={[application("a"), application("b")]} />,
    );

    expect(container.querySelectorAll("article")).toHaveLength(2);
    expect(screen.queryByText(/no applications yet/i)).toBeNull();
  });
});
