// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { JobApplication } from "@/app/generated/prisma/client";
import { FAILED, type ActionResult } from "@/lib/applications/action-result";
import { ApplicationForm } from "./ApplicationForm";

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

describe("ApplicationForm", () => {
  it("offers exactly the four fields the application has", () => {
    render(<ApplicationForm action={noop} />);

    expect(screen.getByLabelText(/company/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/position/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/link/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/notes/i)).toBeInTheDocument();

    // Counted rather than listed: a fifth field added later has to fail here,
    // which asserting the four by name would not catch.
    expect(screen.getAllByRole("textbox")).toHaveLength(4);
  });

  it("marks the company and the position as required, and the rest as not", () => {
    render(<ApplicationForm action={noop} />);

    expect(screen.getByLabelText(/company/i)).toBeRequired();
    expect(screen.getByLabelText(/position/i)).toBeRequired();
    expect(screen.getByLabelText(/link/i)).not.toBeRequired();
    expect(screen.getByLabelText(/notes/i)).not.toBeRequired();
  });
});

describe("ApplicationForm refusals", () => {
  it("ties a field's message to that field", async () => {
    render(
      <ApplicationForm
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
      <ApplicationForm action={refusing({ ok: false, error: "Could not add the application" })} />,
    );

    await submit({ company: "Acme", position: "Dev" });

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not add the application");
    for (const label of [/company/i, /position/i, /link/i, /notes/i]) {
      expect(screen.getByLabelText(label)).not.toHaveAccessibleDescription();
    }
  });
});

describe("ApplicationForm after a refusal", () => {
  it("keeps every value the person typed", async () => {
    // React resets an uncontrolled form once its action resolves, which would
    // throw away the whole submission on a refusal. This is the guard for that.
    render(
      <ApplicationForm
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

describe("ApplicationForm announcing a refusal", () => {
  it("moves focus to the first field at fault", async () => {
    // aria-describedby alone is read when the field next gets focus, not when
    // the message appears. Without moving focus, someone using a screen reader
    // presses the button, hears nothing, and is not told the application was
    // refused - so this is what makes the message reach them.
    render(
      <ApplicationForm
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
    render(<ApplicationForm action={refusing({ ok: true, data: {} as never })} />);

    await submit({ company: "Acme", position: "Dev" });

    expect(screen.getByLabelText(/position/i)).not.toHaveFocus();
    expect(screen.getByLabelText(/company/i)).not.toHaveFocus();
  });
});

/** The stored values of an application the form is opened on. */
const STORED = {
  company: "Acme Cloud",
  position: "Frontend Engineer",
  link: "https://jobs.example.com/42",
  notes: "Referred by Sam",
};

/** The same path as `submit`, but for a form whose button says something else. */
async function submitEdit() {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));
  });
}

function renderEdit(action: Parameters<typeof ApplicationForm>[0]["action"], id = "app-1") {
  return render(
    <ApplicationForm
      action={action}
      id={id}
      initialValues={STORED}
      submitLabel="Save changes"
      pendingLabel="Saving…"
    />,
  );
}

describe("ApplicationForm opened on an existing application", () => {
  it("starts from the stored values", () => {
    renderEdit(noop);

    expect(screen.getByLabelText(/company/i)).toHaveValue(STORED.company);
    expect(screen.getByLabelText(/position/i)).toHaveValue(STORED.position);
    expect(screen.getByLabelText(/link/i)).toHaveValue(STORED.link);
    expect(screen.getByLabelText(/notes/i)).toHaveValue(STORED.notes);
  });

  it("offers the same four fields and no status field", () => {
    renderEdit(noop);

    // The same count the add-mode test makes: a status select added here has to
    // fail, and the hidden id must not show up as a fifth field.
    expect(screen.getAllByRole("textbox")).toHaveLength(4);
    expect(screen.queryByLabelText(/status/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("leaves the optional fields empty when nothing is stored in them", () => {
    render(
      <ApplicationForm
        action={noop}
        id="app-1"
        initialValues={{ ...STORED, link: "", notes: "" }}
        submitLabel="Save changes"
      />,
    );

    // Empty, not the string "null": the dialog maps a stored null to "".
    expect(screen.getByLabelText(/link/i)).toHaveValue("");
    expect(screen.getByLabelText(/notes/i)).toHaveValue("");
  });

  it("submits the id so the action knows which application it is", async () => {
    const seen: FormData[] = [];
    const capture = async (_prev: unknown, formData: FormData) => {
      seen.push(formData);
      return { ok: true, data: {} as never } as const;
    };
    renderEdit(capture);

    await submitEdit();

    expect(seen[0]?.get("id")).toBe("app-1");
    expect(seen[0]?.get("company")).toBe(STORED.company);
  });

  it("submits no id at all when it is adding", async () => {
    // Otherwise an addition would carry an empty id and the create path would
    // have a value it has no business receiving.
    const seen: FormData[] = [];
    const capture = async (_prev: unknown, formData: FormData) => {
      seen.push(formData);
      return { ok: true, data: {} as never } as const;
    };
    render(<ApplicationForm action={capture} />);

    await submit({ company: "Acme", position: "Dev" });

    expect(seen[0]?.has("id")).toBe(false);
  });
});

describe("ApplicationForm refusing an edit", () => {
  /** Types over a stored value, so the refusal has something to lose. */
  function typeOver(label: RegExp, value: string) {
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
  }

  it("keeps what the person typed rather than snapping back to the stored values", async () => {
    // The whole point of the requirement: the refused values are what they are
    // being asked to correct, so restoring the stored ones would throw away the
    // correction and leave no sign of what was wrong.
    renderEdit(
      refusing({
        ok: false,
        error: "Invalid application data",
        fieldErrors: { company: "Company is required" },
      }),
    );

    typeOver(/company/i, "   ");
    typeOver(/position/i, "Staff Engineer");
    await submitEdit();

    expect(screen.getByLabelText(/company/i)).toHaveValue("   ");
    expect(screen.getByLabelText(/position/i)).toHaveValue("Staff Engineer");
    expect(screen.getByLabelText(/company/i)).not.toHaveValue(STORED.company);
  });

  it.each([
    {
      name: "a cleared company",
      field: /company/i,
      value: "   ",
      errors: { company: "Company is required" },
      message: "Company is required",
    },
    {
      name: "a link that is not a web address",
      field: /link/i,
      value: "javascript:alert(1)",
      errors: { link: "Link must be a valid http(s) URL" },
      message: "Link must be a valid http(s) URL",
    },
    {
      name: "a company over the maximum",
      field: /company/i,
      value: "x".repeat(121),
      errors: { company: "Company must be 120 characters or fewer" },
      message: "Company must be 120 characters or fewer",
    },
  ])("names the field at fault and moves focus to it: $name", async (cases) => {
    renderEdit(
      refusing({ ok: false, error: "Invalid application data", fieldErrors: cases.errors }),
    );

    typeOver(cases.field, cases.value);
    await submitEdit();

    const field = await screen.findByLabelText(cases.field);
    expect(field).toHaveAccessibleDescription(cases.message);
    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(field).toHaveFocus();
  });
});

describe("ApplicationForm when an edit cannot be stored", () => {
  it("stays open with its values and says the application was not updated", async () => {
    renderEdit(refusing({ ok: false, error: FAILED.update }));

    fireEvent.change(screen.getByLabelText(/company/i), { target: { value: "Acme Cloud GmbH" } });
    await submitEdit();

    expect(await screen.findByRole("alert")).toHaveTextContent(FAILED.update);
    expect(screen.getByLabelText(/company/i)).toHaveValue("Acme Cloud GmbH");
    expect(screen.getByRole("button", { name: /save changes/i })).toBeInTheDocument();
    // In the one region, not beside a field: no field is at fault here.
    for (const label of [/company/i, /position/i, /link/i, /notes/i]) {
      expect(screen.getByLabelText(label)).not.toHaveAccessibleDescription();
    }
  });

  it("attempts the write again when the person submits again", async () => {
    // "The submission can be retried" is otherwise an assumption: the form
    // staying open does not prove the button still reaches the action.
    const action = vi.fn(async () => ({ ok: false, error: FAILED.update }) as const);
    renderEdit(action);

    await submitEdit();
    expect(action).toHaveBeenCalledTimes(1);

    await submitEdit();
    expect(action).toHaveBeenCalledTimes(2);
    // The same values, not a form that quietly emptied itself between tries.
    const [, formData] = action.mock.calls[1] as unknown as [unknown, FormData];
    expect(formData.get("company")).toBe(STORED.company);
  });

  it("says the application was not found rather than that the storage failed", async () => {
    // Two different things to be told: "not found" means somebody deleted it
    // and retrying will never help, which the generic message would hide.
    renderEdit(refusing({ ok: false, error: "Application not found" }));

    await submitEdit();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Application not found");
    expect(alert).not.toHaveTextContent(FAILED.update);
  });
});
