import { describe, expect, it } from "vitest";
import { validateApplicationInput } from "./validation";

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
