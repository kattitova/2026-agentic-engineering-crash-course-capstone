// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { JobApplication } from "@/app/generated/prisma/client";
import type { ActionResult } from "@/lib/applications/action-result";
import { AddApplicationForm } from "./AddApplicationForm";

// The config deliberately has no `globals: true`, so RTL's automatic cleanup
// never registers itself. Without this, renders pile up in one document.
afterEach(cleanup);

/** Never called in these tests; the form's own submission is an e2e concern. */
const noop = vi.fn<
  (prev: unknown, formData: FormData) => Promise<ActionResult<JobApplication>>
>();

describe("AddApplicationForm", () => {
  it("offers exactly the four fields the application has", () => {
    render(<AddApplicationForm action={noop} />);

    expect(screen.getByLabelText(/company/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/position/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/link/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/notes/i)).toBeInTheDocument();

    // Counted rather than listed: a fifth field added later has to fail here,
    // which asserting the four by name would not catch.
    expect(screen.getAllByRole("textbox")).toHaveLength(4);
  });

  it("marks the company and the position as required, and the rest as not", () => {
    render(<AddApplicationForm action={noop} />);

    expect(screen.getByLabelText(/company/i)).toBeRequired();
    expect(screen.getByLabelText(/position/i)).toBeRequired();
    expect(screen.getByLabelText(/link/i)).not.toBeRequired();
    expect(screen.getByLabelText(/notes/i)).not.toBeRequired();
  });
});
