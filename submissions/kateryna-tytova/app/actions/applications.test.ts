import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@/app/generated/prisma/client";

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
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const {
  createApplicationFromForm,
  createApplication,
  updateApplicationStatus,
  updateApplication,
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
  for (const mock of [create, update, remove, findUnique]) {
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
