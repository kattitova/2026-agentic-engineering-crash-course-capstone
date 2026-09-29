import { describe, expect, it } from "vitest";
import { APPLICATION_LIMITS, validateApplicationInput } from "./validation";

describe("validateApplicationInput", () => {
  it("accepts required fields and trims them", () => {
    expect(
      validateApplicationInput({ company: "  Acme ", position: " Frontend Engineer  " }),
    ).toEqual({
      ok: true,
      data: { company: "Acme", position: "Frontend Engineer", link: null, notes: null },
    });
  });

  it("keeps optional link and notes when provided", () => {
    expect(
      validateApplicationInput({
        company: "Acme",
        position: "Dev",
        link: " https://jobs.example.com/123 ",
        notes: "Referral from Ann",
      }),
    ).toEqual({
      ok: true,
      data: {
        company: "Acme",
        position: "Dev",
        link: "https://jobs.example.com/123",
        notes: "Referral from Ann",
      },
    });
  });

  it("turns blank optional fields into null", () => {
    const result = validateApplicationInput({
      company: "Acme",
      position: "Dev",
      link: "   ",
      notes: "",
    });
    expect(result).toEqual({
      ok: true,
      data: { company: "Acme", position: "Dev", link: null, notes: null },
    });
  });

  it("rejects missing or blank company and position", () => {
    expect(validateApplicationInput({ company: "   " })).toEqual({
      ok: false,
      errors: {
        company: "Company is required",
        position: "Position is required",
      },
    });
  });

  it("rejects a link that isn't an http(s) URL", () => {
    for (const link of ["not a url", "ftp://example.com", "javascript:alert(1)"]) {
      expect(
        validateApplicationInput({ company: "Acme", position: "Dev", link }),
      ).toEqual({
        ok: false,
        errors: { link: "Link must be a valid http(s) URL" },
      });
    }
  });

  it("rejects non-string values", () => {
    const result = validateApplicationInput({ company: 42, position: ["Dev"] });
    expect(result.ok).toBe(false);
  });
});

describe("validateApplicationInput length limits", () => {
  // A link has to stay a valid http(s) URL while it grows, or the length case
  // would be indistinguishable from the URL case.
  const linkOfLength = (length: number) =>
    `https://example.com/${"a".repeat(length - "https://example.com/".length)}`;

  const cases = [
    { field: "company", limit: APPLICATION_LIMITS.company, atMax: "a".repeat(APPLICATION_LIMITS.company) },
    { field: "position", limit: APPLICATION_LIMITS.position, atMax: "a".repeat(APPLICATION_LIMITS.position) },
    { field: "link", limit: APPLICATION_LIMITS.link, atMax: linkOfLength(APPLICATION_LIMITS.link) },
    { field: "notes", limit: APPLICATION_LIMITS.notes, atMax: "a".repeat(APPLICATION_LIMITS.notes) },
  ] as const;

  const valid = { company: "Acme", position: "Dev" };

  it.each(cases)("rejects a $field one character over $limit", ({ field, limit, atMax }) => {
    const overMax = field === "link" ? linkOfLength(limit + 1) : `${atMax}a`;
    const result = validateApplicationInput({ ...valid, [field]: overMax });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[field]).toMatch(new RegExp(`${field}`, "i"));
    expect(result.errors[field]).toContain(String(limit));
  });

  it("measures the trimmed value, not the raw one", () => {
    // The stored value is what has to fit, and trimming happens first. Checking
    // the raw string would reject a paste that only looks too long.
    const padded = `  ${"a".repeat(APPLICATION_LIMITS.company)}  `;
    expect(padded.length).toBeGreaterThan(APPLICATION_LIMITS.company);

    expect(validateApplicationInput({ ...valid, company: padded })).toMatchObject({
      ok: true,
      data: { company: "a".repeat(APPLICATION_LIMITS.company) },
    });
  });

  it.each(cases)("accepts a $field of exactly $limit", ({ field, atMax }) => {
    const result = validateApplicationInput({ ...valid, [field]: atMax });

    expect(result).toMatchObject({ ok: true, data: { [field]: atMax } });
  });
});
