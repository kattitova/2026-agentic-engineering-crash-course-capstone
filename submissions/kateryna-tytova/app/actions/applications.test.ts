import { beforeEach, describe, expect, it, vi } from "vitest";
import { redirect } from "next/navigation";
import { Prisma } from "@/app/generated/prisma/client";
import { FAILED } from "@/lib/applications/action-result";

const create = vi.fn();
const update = vi.fn();
const remove = vi.fn();
const findUnique = vi.fn();
const transaction = vi.fn();

/** The real one runs its callback against a transactional client; here it is the same mocks. */
function transactionRunsItsCallback() {
  transaction.mockImplementation(async (run: (tx: unknown) => unknown) =>
    run({ jobApplication: { findUnique, update } }),
  );
}

vi.mock("@/lib/prisma", () => ({
  prisma: {
    jobApplication: { create, update, delete: remove, findUnique },
    $transaction: transaction,
  },
}));
const revalidatePath = vi.fn();

// Referenceable rather than inline: two requirements turn on *whether* the
// board is revalidated, not only on what an action returns.
vi.mock("next/cache", () => ({ revalidatePath }));

const {
  createApplicationFromForm,
  createApplication,
  updateApplicationStatus,
  updateApplication,
  updateApplicationFromForm,
  deleteApplication,
} = await import("./applications");

const VALID = { company: "Acme", position: "Dev" };

function formData(values: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) {
    data.set(key, value);
  }
  return data;
}

beforeEach(() => {
  for (const mock of [create, update, remove, findUnique, revalidatePath]) {
    mock.mockReset();
  }
  // mockReset, not mockClear: a test that makes the transaction reject would
  // otherwise leave that implementation in place for every test after it.
  transaction.mockReset();
  transactionRunsItsCallback();
});

describe("createApplicationFromForm", () => {
  it("reports a failed write instead of throwing past the form", async () => {
    // A throwing action does not reach the form's error state at all: React
    // rethrows it during render, the nearest boundary is app/error.tsx, and it
    // replaces the whole page - so the dialog, and everything typed into it,
    // are gone, under a message about a failed *read*.
    create.mockRejectedValue(new Error("database is locked"));

    const result = await createApplicationFromForm(
      null,
      formData({ company: "Acme", position: "Dev", link: "", notes: "" }),
    );

    expect(result).toEqual({ ok: false, error: "The application was not added. Please try again." });
  });

  it("passes a successful write straight through", async () => {
    create.mockResolvedValue({ id: "new", company: "Acme" });

    const result = await createApplicationFromForm(
      null,
      formData({ company: "Acme", position: "Dev", link: "", notes: "" }),
    );

    expect(result).toEqual({ ok: true, data: { id: "new", company: "Acme" } });
  });

  it("still reports a validation failure per field, without touching the database", async () => {
    const result = await createApplicationFromForm(
      null,
      formData({ company: "   ", position: "Dev", link: "", notes: "" }),
    );

    expect(result).toMatchObject({ ok: false, fieldErrors: { company: "Company is required" } });
    expect(create).not.toHaveBeenCalled();
  });
});

describe("a storage failure no action can classify", () => {
  const BOOM = new Error("database is locked");

  it("createApplication reports it instead of throwing", async () => {
    create.mockRejectedValue(BOOM);

    await expect(createApplication(VALID)).resolves.toEqual({
      ok: false,
      error: "The application was not added. Please try again.",
    });
  });

  it("updateApplicationStatus reports it instead of throwing", async () => {
    transaction.mockRejectedValue(BOOM);

    await expect(updateApplicationStatus("a", "OFFER")).resolves.toEqual({
      ok: false,
      error: "The move was not saved. Please try again.",
    });
  });

  it("updateApplication reports it instead of throwing", async () => {
    update.mockRejectedValue(BOOM);

    await expect(updateApplication("a", VALID)).resolves.toEqual({
      ok: false,
      error: "The application was not updated. Please try again.",
    });
  });

  it("deleteApplication reports it instead of throwing", async () => {
    remove.mockRejectedValue(BOOM);

    await expect(deleteApplication("a")).resolves.toEqual({
      ok: false,
      error: "The application was not deleted. Please try again.",
    });
  });
});

describe("a failure the actions do classify keeps its own message", () => {
  // The guard for the catch-all swallowing the specific case: P2025 has to win
  // over the generic message, not be flattened into it.
  // The real class: isRecordNotFound tests with instanceof, so a plain object
  // wearing a code would be reported as an unclassified failure and this guard
  // would pass against a broken implementation.
  const NOT_FOUND = new Prisma.PrismaClientKnownRequestError("not found", {
    code: "P2025",
    clientVersion: "test",
  });

  it("updateApplication still says the application was not found", async () => {
    update.mockRejectedValue(NOT_FOUND);

    await expect(updateApplication("a", VALID)).resolves.toEqual({
      ok: false,
      error: "Application not found",
    });
  });

  it("deleteApplication still says the application was not found", async () => {
    remove.mockRejectedValue(NOT_FOUND);

    await expect(deleteApplication("a")).resolves.toEqual({
      ok: false,
      error: "Application not found",
    });
  });

  it("updateApplicationStatus still says the application was not found", async () => {
    findUnique.mockResolvedValue(null);

    await expect(updateApplicationStatus("a", "OFFER")).resolves.toEqual({
      ok: false,
      error: "Application not found",
    });
  });

  it("an invalid id is still rejected before the database is touched", async () => {
    await expect(updateApplication("", VALID)).resolves.toEqual({
      ok: false,
      error: "Invalid application id",
    });
    expect(update).not.toHaveBeenCalled();
  });
});

describe("Next's own control-flow throws are not swallowed", () => {
  // redirect(), notFound() and their siblings signal by throwing. A catch-all
  // that returns a result for them means the redirect silently never happens
  // and the action reports a failure for a write that succeeded - the opposite
  // of what happened. No action calls one today; MVP item 4 is where somebody
  // adds a redirect after saving an edit, and they would have no way to see
  // that the catch two screens down is what broke it.
  //
  // Measured rather than faked: outside a request redirect() throws an Error
  // whose message is NEXT_REDIRECT and whose digest carries the target, and
  // unstable_rethrow recognises exactly that.
  const cases = [
    { name: "createApplication", mock: () => create, call: () => createApplication(VALID) },
    {
      name: "updateApplicationStatus",
      mock: () => transaction,
      call: () => updateApplicationStatus("a", "OFFER"),
    },
    { name: "updateApplication", mock: () => update, call: () => updateApplication("a", VALID) },
    { name: "deleteApplication", mock: () => remove, call: () => deleteApplication("a") },
  ] as const;

  it.each(cases)("$name lets a redirect through", async ({ mock, call }) => {
    mock().mockImplementation(() => {
      redirect("/elsewhere");
    });

    await expect(call()).rejects.toMatchObject({
      message: "NEXT_REDIRECT",
      digest: expect.stringContaining("NEXT_REDIRECT"),
    });
  });
});

describe("an edit writes the four fields the form collects, and nothing else", () => {
  // The spec requirement is about status, appliedDate and statusChangedAt
  // surviving an edit, and this is the only place they could be written: there
  // is no second write path, so the fields absent from `data` are the whole
  // guarantee. A regression guard rather than a red-first test - the guarantee
  // already holds by construction, because `data` is whatever
  // validateApplicationInput returned and that is exactly the four fields.
  it("passes exactly company, position, link and notes", async () => {
    update.mockResolvedValue({ id: "a" });

    await updateApplication("a", {
      company: "Acme",
      position: "Dev",
      link: "https://example.test/job",
      notes: "note",
    });

    expect(update).toHaveBeenCalledWith({
      where: { id: "a" },
      data: { company: "Acme", position: "Dev", link: "https://example.test/job", notes: "note" },
    });
    // Asserted on the keys too: toHaveBeenCalledWith on the object above would
    // already fail on an extra key, but saying it this way is what fails
    // legibly if someone adds `statusChangedAt: new Date()` here.
    const [{ data }] = update.mock.calls[0] as [{ data: Record<string, unknown> }];
    expect(Object.keys(data).sort()).toEqual(["company", "link", "notes", "position"]);
  });
});

describe("an action that finds the row gone tells the board", () => {
  // Without this the board goes on showing a card for a row that no longer
  // exists until somebody reloads, which both deltas forbid. The move action
  // already revalidated here; these two did not.
  const NOT_FOUND = new Prisma.PrismaClientKnownRequestError("not found", {
    code: "P2025",
    clientVersion: "test",
  });

  it("updateApplication revalidates the board", async () => {
    update.mockRejectedValue(NOT_FOUND);

    await expect(updateApplication("a", VALID)).resolves.toEqual({
      ok: false,
      error: "Application not found",
    });
    expect(revalidatePath).toHaveBeenCalledWith("/");
  });

  it("deleteApplication revalidates the board", async () => {
    remove.mockRejectedValue(NOT_FOUND);

    await expect(deleteApplication("a")).resolves.toEqual({
      ok: false,
      error: "Application not found",
    });
    expect(revalidatePath).toHaveBeenCalledWith("/");
  });

  it("an unclassifiable failure does not revalidate, because nothing changed", async () => {
    // The other half of the pair: revalidating on every failure would be the
    // easy way to make the two tests above pass, and it would refetch the board
    // after a write that provably did not happen.
    update.mockRejectedValue(new Error("database is locked"));

    await updateApplication("a", VALID);
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("updateApplicationFromForm", () => {
  // The id arrives in a hidden field, which makes it as untrusted as any other
  // form value - so the wrapper hands it over untouched and the action's own
  // isValidId is what refuses it. Coercing here would add a second place that
  // decides what counts as an id.
  const EDIT = { id: "a", company: "Acme", position: "Dev", link: "", notes: "" };

  it("sends the id and the four values to updateApplication", async () => {
    update.mockResolvedValue({ id: "a" });

    await updateApplicationFromForm(null, formData(EDIT));

    expect(update).toHaveBeenCalledWith({
      where: { id: "a" },
      // The empty link and notes arrive as null, not as "": the same
      // optionalText rule the add path uses.
      data: { company: "Acme", position: "Dev", link: null, notes: null },
    });
  });

  it("refuses an edit with a cleared company without touching the database", async () => {
    const result = await updateApplicationFromForm(null, formData({ ...EDIT, company: "   " }));

    expect(result).toEqual({
      ok: false,
      error: "Invalid application data",
      fieldErrors: { company: "Company is required" },
    });
    expect(update).not.toHaveBeenCalled();
  });

  it("refuses a missing id before the database is touched", async () => {
    const noId = formData({ company: "Acme", position: "Dev" });

    await expect(updateApplicationFromForm(null, noId)).resolves.toEqual({
      ok: false,
      error: "Invalid application id",
    });
    expect(update).not.toHaveBeenCalled();
  });

  it("refuses an empty id the same way", async () => {
    await expect(updateApplicationFromForm(null, formData({ ...EDIT, id: "" }))).resolves.toEqual({
      ok: false,
      error: "Invalid application id",
    });
    expect(update).not.toHaveBeenCalled();
  });

  it("says the application was not found, not that the storage failed", async () => {
    // The two failures read the same to the person unless they are kept apart:
    // "not found" means somebody deleted it, and retrying will never help.
    update.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("not found", {
        code: "P2025",
        clientVersion: "test",
      }),
    );

    const result = await updateApplicationFromForm(null, formData(EDIT));

    expect(result).toEqual({ ok: false, error: "Application not found" });
    expect(result).not.toEqual({ ok: false, error: FAILED.update });
  });

  it("says the application was not updated when the storage fails", async () => {
    update.mockRejectedValue(new Error("database is locked"));

    await expect(updateApplicationFromForm(null, formData(EDIT))).resolves.toEqual({
      ok: false,
      error: FAILED.update,
    });
  });
});
