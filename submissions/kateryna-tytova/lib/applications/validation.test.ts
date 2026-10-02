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
        errors: { link: "Link must be a full web address, like https://example.com/job" },
      });
    }
  });

  // Parsing as a URL is weaker than being an address: a bare word is a valid
  // host to the parser, and the card would then offer it as a link to a posting
  // that cannot be reached.
  it("rejects a link whose host is not a domain name", () => {
    const hosts = [
      "https://test",
      "http://a",
      "https://.com",
      "https://a..b",
      "https://-.com",
      "https://example.com.",
      // A one-character top-level name written in Latin script. The encoded
      // spelling is a known gap, covered in the accepted cases below.
      "https://a.b",
      "https://localhost:3000",
      "https://127.0.0.1",
      "https://[::1]",
    ];

    for (const link of hosts) {
      const result = validateApplicationInput({ company: "Acme", position: "Dev", link });

      expect(result.ok, link).toBe(false);
      if (result.ok) continue;
      // Which message it is belongs to the message test; here it only has to
      // be the link field's.
      expect(result.errors.link, link).toMatch(/link/i);
    }
  });

  // Guards rather than a red step: every one of these passes today, and the
  // point is that they still pass once the host rule lands. Without them an
  // over-strict rule would go green on the refusal cases alone.
  it("keeps accepting an ordinary posting address", () => {
    const links = [
      "https://example.com/jobs/1",
      "http://example.com",
      "https://jobs.example.co.uk/1",
      // Copied out of an address bar, tracking parameters and all.
      "https://www.linkedin.com/jobs/view/3912345678/?refId=aBcDeF%3D%3D&trackingId=XyZ%2BaBc%3D",
      // An underscore is not in the DNS hostname grammar, but URL keeps it in
      // the host and a careers site can be named this way.
      "https://careers_eu.example.com",
      // A real internationalised domain, under a top-level name of more than
      // one character.
      "https://приклад.укр",
      // Accepted deliberately, and recorded here so the gap is visible rather
      // than discovered: the root zone has no one-character name in any script,
      // but telling `.д` from a real one means decoding the punycode label.
      // The length of the encoded form cannot stand in for that - a
      // one-character name encodes to three characters in Cyrillic and to four
      // in Hangul, so a length rule would refuse `д` and accept `컴`. Nothing
      // anyone can paste reaches this case.
      "https://прикла.д",
    ];

    for (const link of links) {
      const result = validateApplicationInput({ company: "Acme", position: "Dev", link });

      expect(result.ok, link).toBe(true);
    }
  });

  // The host here is a perfectly good domain, so the host rule above does not
  // cover this one. It is refused because the card presents a stored link as
  // something to open, and credentials in front of the host are how one domain
  // is made to look like another.
  it("rejects a link that carries credentials", () => {
    const result = validateApplicationInput({
      company: "Acme",
      position: "Dev",
      link: "https://user:pass@example.com",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.link).toMatch(/link/i);
  });

  // The one fault a person reaches by hand is a bare domain, and "invalid" does
  // not tell them what is missing. One message covers every cause, so it has to
  // describe the target shape rather than the fault: the field, what a web
  // address is, and an example to copy.
  it("says what a link should look like", () => {
    const result = validateApplicationInput({
      company: "Acme",
      position: "Dev",
      link: "example.com",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.link).toMatch(/link/i);
    expect(result.errors.link).toMatch(/address/i);
    expect(result.errors.link).toContain("https://example.com");
  });

  it("rejects non-string values", () => {
    const result = validateApplicationInput({ company: 42, position: ["Dev"] });
    expect(result.ok).toBe(false);
  });
});

describe("validateApplicationInput length limits", () => {
  // A link has to stay an acceptable link while it grows, or the length case
  // would be indistinguishable from the link-shape case. `example.com` is a
  // domain under the host rule at any length, so this needs nothing more.
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

  // The numbers themselves. Every case below reads the constant, so without
  // this nothing would notice a limit being widened - and 512 for the link is a
  // measurement worth pinning: the longest real posting address found was about
  // 130 characters, a LinkedIn link with its tracking parameters.
  it("bounds each field at its agreed maximum", () => {
    expect(APPLICATION_LIMITS).toEqual({
      company: 120,
      position: 120,
      link: 512,
      notes: 2000,
    });
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

describe("validateApplicationInput non-text values", () => {
  it("rejects a File, which is what FormData yields for a file input", () => {
    // The form-shaped action passes FormData values through without coercing
    // them, so this is the check that catches a company that is not text.
    const result = validateApplicationInput({
      company: new File(["Acme"], "company.txt"),
      position: "Dev",
    });

    expect(result).toEqual({ ok: false, errors: { company: "Company is required" } });
  });
});

describe("validateApplicationInput line endings", () => {
  // A textarea serialises its line breaks as CRLF on submit, while its own
  // maxLength counts each break as one character. Measured in a real browser
  // (e2e/add-application.spec.ts): the note reached the database with a
  // carriage return before the newline. Left alone, a note the textarea accepts
  // at exactly the maximum arrives one character over per line break and is
  // refused by a message that contradicts what the person is looking at.
  it("stores a line break as one character, not two", () => {
    const result = validateApplicationInput({
      company: "Acme",
      position: "Dev",
      notes: "first\r\nsecond",
    });

    expect(result).toMatchObject({ ok: true, data: { notes: "first\nsecond" } });
  });

  it("accepts a note at the maximum that the textarea would have accepted", () => {
    const typed = Array.from({ length: 11 }, () => "a").join("\n");
    const asTyped = `${typed}${"b".repeat(APPLICATION_LIMITS.notes - typed.length)}`;
    expect(asTyped.length).toBe(APPLICATION_LIMITS.notes);

    const result = validateApplicationInput({
      company: "Acme",
      position: "Dev",
      notes: asTyped.replace(/\n/g, "\r\n"),
    });

    expect(result.ok).toBe(true);
  });
});
