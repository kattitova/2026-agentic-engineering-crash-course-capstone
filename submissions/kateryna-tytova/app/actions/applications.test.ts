import { beforeEach, describe, expect, it, vi } from "vitest";

const create = vi.fn();

vi.mock("@/lib/prisma", () => ({ prisma: { jobApplication: { create } } }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { createApplicationFromForm } = await import("./applications");

function formData(values: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) {
    data.set(key, value);
  }
  return data;
}

beforeEach(() => {
  create.mockReset();
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
