// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
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

/** Stands in for the server action so a refusal can be rendered in jsdom. */
function refusing(result: ActionResult<JobApplication>) {
  return async () => result;
}

/**
 * React drives a form action from the submit event, so this is the whole path:
 * the action runs, resolves, and the state it returns is rendered. `act` waits
 * for that so the assertions do not race it.
 */
async function submit(values: { company: string; position: string }) {
  // jsdom enforces `required` on submit, so the required fields have to hold
  // something or the action never runs at all. Whitespace satisfies the
  // browser and is refused by the validator, which is the case worth having.
  fireEvent.change(screen.getByLabelText(/company/i), { target: { value: values.company } });
  fireEvent.change(screen.getByLabelText(/position/i), { target: { value: values.position } });

  const button = screen.getByRole("button", { name: /add application/i });
  await act(async () => {
    fireEvent.click(button);
  });
}

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

describe("AddApplicationForm refusals", () => {
  it("ties a field's message to that field", async () => {
    render(
      <AddApplicationForm
        action={refusing({
          ok: false,
          error: "Invalid application data",
          fieldErrors: { company: "Company is required" },
        })}
      />,
    );

    await submit({ company: "   ", position: "Dev" });

    const company = await screen.findByLabelText(/company/i);
    // The description, not merely the text being on screen: a message rendered
    // beside the field but not referenced by it reads as loose text.
    expect(company).toHaveAccessibleDescription("Company is required");
    expect(company).toHaveAttribute("aria-invalid", "true");

    const position = screen.getByLabelText(/position/i);
    expect(position).not.toHaveAccessibleDescription();
    expect(position).not.toHaveAttribute("aria-invalid", "true");
  });

  it("shows an error with no field in one region rather than beside a field", async () => {
    render(
      <AddApplicationForm action={refusing({ ok: false, error: "Could not add the application" })} />,
    );

    await submit({ company: "Acme", position: "Dev" });

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not add the application");
    for (const label of [/company/i, /position/i, /link/i, /notes/i]) {
      expect(screen.getByLabelText(label)).not.toHaveAccessibleDescription();
    }
  });
});

describe("AddApplicationForm after a refusal", () => {
  it("keeps every value the person typed", async () => {
    // React resets an uncontrolled form once its action resolves, which would
    // throw away the whole submission on a refusal. This is the guard for that.
    render(
      <AddApplicationForm
        action={refusing({
          ok: false,
          error: "Invalid application data",
          fieldErrors: { company: "Company is required" },
        })}
      />,
    );

    fireEvent.change(screen.getByLabelText(/link/i), {
      target: { value: "https://jobs.example.com/1" },
    });
    fireEvent.change(screen.getByLabelText(/notes/i), { target: { value: "Referral" } });
    await submit({ company: "   ", position: "Platform Engineer" });

    expect(screen.getByLabelText(/company/i)).toHaveValue("   ");
    expect(screen.getByLabelText(/position/i)).toHaveValue("Platform Engineer");
    expect(screen.getByLabelText(/link/i)).toHaveValue("https://jobs.example.com/1");
    expect(screen.getByLabelText(/notes/i)).toHaveValue("Referral");
  });
});

describe("AddApplicationForm announcing a refusal", () => {
  it("moves focus to the first field at fault", async () => {
    // aria-describedby alone is read when the field next gets focus, not when
    // the message appears. Without moving focus, someone using a screen reader
    // presses the button, hears nothing, and is not told the application was
    // refused - so this is what makes the message reach them.
    render(
      <AddApplicationForm
        action={refusing({
          ok: false,
          error: "Invalid application data",
          fieldErrors: { position: "Position is required", link: "Link must be a valid http(s) URL" },
        })}
      />,
    );

    await submit({ company: "Acme", position: "   " });

    // The first in document order, not the first key of the object.
    expect(screen.getByLabelText(/position/i)).toHaveFocus();
  });

  it("leaves focus alone when the submission is accepted", async () => {
    render(<AddApplicationForm action={refusing({ ok: true, data: {} as never })} />);

    await submit({ company: "Acme", position: "Dev" });

    expect(screen.getByLabelText(/position/i)).not.toHaveFocus();
    expect(screen.getByLabelText(/company/i)).not.toHaveFocus();
  });
});
