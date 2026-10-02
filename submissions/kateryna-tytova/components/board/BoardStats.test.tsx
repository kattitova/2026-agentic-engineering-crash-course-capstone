// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { BoardSummary } from "@/lib/applications/stats";
import { BoardStats } from "./BoardStats";

afterEach(cleanup);

function summary(overrides: Partial<BoardSummary> = {}): BoardSummary {
  return { total: 15, reachedInterview: 3, percentReachedInterview: 20, ...overrides };
}

/**
 * The region's own text, so an assertion cannot be satisfied by something
 * elsewhere on a rendered page.
 */
function region(): HTMLElement {
  return screen.getByRole("region", { name: "Application summary" });
}

describe("BoardStats", () => {
  it("shows both figures written out", () => {
    render(<BoardStats summary={summary()} />);

    expect(region()).toHaveTextContent("15 applications");
    expect(region()).toHaveTextContent("20% reached interview");
  });

  it("is a named landmark, so it can be reached like a column", () => {
    render(<BoardStats summary={summary()} />);

    expect(region()).toBeInTheDocument();
  });

  it("names the counted set beside the percentage", () => {
    render(<BoardStats summary={summary()} />);

    expect(region()).toHaveTextContent("Interview or Offer");
  });

  it("names the counted set when nothing has reached interview either", () => {
    render(<BoardStats summary={summary({ total: 8, reachedInterview: 0, percentReachedInterview: 0 })} />);

    expect(region()).toHaveTextContent("0% reached interview");
    expect(region()).toHaveTextContent("Interview or Offer");
  });

  it("says a rejection is not counted, which is the one thing the figure cannot show", () => {
    render(<BoardStats summary={summary()} />);

    expect(region()).toHaveTextContent(/rejected application is not counted/i);
  });

  describe("an empty board", () => {
    const empty = summary({ total: 0, reachedInterview: 0, percentReachedInterview: null });

    it("is still shown, and reads as nothing yet rather than as a missing value", () => {
      render(<BoardStats summary={empty} />);

      expect(region()).toHaveTextContent("No applications yet");
    });

    it("shows no percentage at all", () => {
      render(<BoardStats summary={empty} />);

      // The absence of the string, not of a particular element: the spec forbids
      // the output however it is produced.
      expect(region().textContent).not.toContain("%");
    });

    it("never shows 0%", () => {
      render(<BoardStats summary={empty} />);

      expect(region().textContent).not.toContain("0%");
    });
  });

  describe("the total's wording", () => {
    it("is singular for one application", () => {
      render(<BoardStats summary={summary({ total: 1, reachedInterview: 1, percentReachedInterview: 100 })} />);

      expect(region()).toHaveTextContent("1 application");
      expect(region().textContent).not.toContain("1 applications");
    });

    it("is plural for two", () => {
      render(<BoardStats summary={summary({ total: 2, reachedInterview: 1, percentReachedInterview: 50 })} />);

      expect(region()).toHaveTextContent("2 applications");
    });

    it("is words rather than a bare zero for an empty board", () => {
      render(<BoardStats summary={summary({ total: 0, reachedInterview: 0, percentReachedInterview: null })} />);

      expect(region()).toHaveTextContent("No applications yet");
      expect(region().textContent).not.toContain("0 applications");
    });
  });

  describe("nothing here is abbreviated", () => {
    it("carries the word 'applications' with the total, not a bare number", () => {
      render(<BoardStats summary={summary()} />);

      // The decision that the visible text is also the accessible text only holds
      // while nothing is shortened. The accessible name of the region plus its
      // text content is all a screen reader gets - there is no .sr-only twin.
      expect(region()).toHaveTextContent("15 applications");
      expect(region().querySelector(".sr-only")).toBeNull();
      expect(region().querySelector("[aria-hidden]")).toBeNull();
    });

    it("says what the percentage measures in the same phrase as the number", () => {
      render(<BoardStats summary={summary()} />);

      expect(region()).toHaveTextContent("20% reached interview");
    });
  });

  it("renders a four-digit total without an extra form of the number", () => {
    render(<BoardStats summary={summary({ total: 1000, reachedInterview: 250, percentReachedInterview: 25 })} />);

    // Layout is NOT asserted here. jsdom has no layout engine, so every element
    // measures zero and any claim about width or wrapping could only be a class
    // substring - which R20260927-6 deleted from this project as a test that
    // could not fail. The widths are measured in e2e/long-value-layout.spec.ts.
    expect(region()).toHaveTextContent("1000 applications");
  });
});
