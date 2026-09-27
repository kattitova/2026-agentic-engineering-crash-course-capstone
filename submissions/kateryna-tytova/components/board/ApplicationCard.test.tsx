// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
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

  it("wraps and clamps long values so one card cannot widen its column", () => {
    // Weak by nature: jsdom has no layout, so this asserts the classes are
    // applied, not the resulting geometry. Task 4.6 checks the real thing.
    const long = "A".repeat(200);
    render(<ApplicationCard application={application({ company: long, position: long })} />);

    for (const text of [screen.getByText(long, { selector: "h3" }), screen.getByText(long, { selector: "p" })]) {
      expect(text.className).toContain("break-words");
      expect(text.className).toContain("line-clamp-");
    }
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
