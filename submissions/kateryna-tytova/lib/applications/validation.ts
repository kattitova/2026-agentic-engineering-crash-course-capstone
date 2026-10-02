export interface ApplicationInput {
  company: string;
  position: string;
  link: string | null;
  notes: string | null;
}

export type ValidationErrors = Partial<Record<keyof ApplicationInput, string>>;

export type ValidationResult =
  | { ok: true; data: ApplicationInput }
  | { ok: false; errors: ValidationErrors };

/** Untrusted input as it arrives from a form or a server action call. */
export interface RawApplicationInput {
  company?: unknown;
  position?: unknown;
  link?: unknown;
  notes?: unknown;
}

/**
 * The maximum length of each stored value, in characters, measured after
 * trimming. These are a guard against unbounded input rather than a guess at
 * the longest real name.
 *
 * 512 for the link is measured rather than conventional: the longest realistic
 * posting address is around 130 characters - a LinkedIn link copied out of the
 * address bar, with its `refId` and `trackingId` - and a clean posting path is
 * well under that. It replaced 2048, the conventional ceiling for a URL, which
 * was sixteen times what the field needs. 512 leaves room for a longer tracking
 * tail, because a paste cut short would store a dead link that looks whole.
 */
export const APPLICATION_LIMITS = {
  company: 120,
  position: 120,
  link: 512,
  notes: 2000,
} as const satisfies Record<keyof ApplicationInput, number>;

/**
 * A textarea submits its line breaks as CRLF while its own `maxLength` counts
 * each break as one character, so without this a note the field accepted at
 * exactly the maximum arrives over it. Normalising also keeps one line ending
 * in the database whatever submitted the value.
 */
function normaliseNewlines(value: string): string {
  return value.replace(/\r\n?/g, "\n");
}

function requiredText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = normaliseNewlines(value).trim();
  return trimmed === "" ? null : trimmed;
}

/** `undefined` means the value has the wrong type; `null` means it was left empty. */
function optionalText(value: unknown): string | null | undefined {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = normaliseNewlines(value).trim();
  return trimmed === "" ? null : trimmed;
}

/**
 * A host made of dot-separated labels, none empty and none starting or ending
 * with a hyphen, under a top-level name of at least two characters.
 *
 * An underscore is allowed inside a label: the DNS hostname grammar has no
 * place for it, but `URL` keeps it in the host and a careers site can be named
 * `careers_eu.example.com`, so refusing it would reject an address that
 * resolves. The price is that `_.com` passes - a name nobody can register, so
 * the result is a link that does not open rather than one that misleads.
 *
 * The `xn--` alternative is how an internationalised name survives this: `URL`
 * converts it to punycode, so `https://приклад.укр` arrives as
 * `xn--80aikifvh.xn--j1amh`, and a letters-only top-level name would refuse
 * every non-Latin domain.
 *
 * The two-character minimum therefore applies only to a name written in Latin
 * script: `a.b` is refused, while `прикла.д` is accepted even though the root
 * zone has no one-character name in any script. Telling them apart means
 * decoding the punycode label, and the length of the encoded form cannot
 * substitute for it - a one-character name encodes to three characters in Latin
 * and Cyrillic ranges but to four in Hangul and much of CJK, so any length rule
 * would refuse `д` and accept `컴`. Accepted rather than decoded: no root-zone
 * name is one character, so no address anyone can paste reaches this case, and
 * the cost of the gap is a hand-typed value stored as a link that does not open.
 */
const DOMAIN_HOST =
  /^(?!-)[a-z0-9_-]+(?<!-)(?:\.(?!-)[a-z0-9_-]+(?<!-))*\.(?:[a-z]{2,}|xn--[a-z0-9-]+)$/;

/**
 * Exported so the render path can re-check a stored value it did not write.
 *
 * Parsing as a URL is the weakest part of this: any non-empty host satisfies
 * `new URL()`, so `https://test` and `https://.com` are URLs by that measure
 * and addresses by none. The host rule is what makes the difference, and
 * `localhost` and numeric hosts fall to it without being named - a job posting
 * is not served by the machine running the tracker.
 */
export function isAcceptableLink(value: string): boolean {
  try {
    const { protocol, hostname, username, password } = new URL(value);
    if (protocol !== "http:" && protocol !== "https:") {
      return false;
    }
    // Checked apart from the host, because the host in
    // `https://user:pass@example.com` is a real domain: hiding this inside the
    // host pattern would hide one rule inside another.
    if (username !== "" || password !== "") {
      return false;
    }
    return DOMAIN_HOST.test(hostname);
  } catch {
    return false;
  }
}

const FIELD_LABELS = {
  company: "Company",
  position: "Position",
  link: "Link",
  notes: "Notes",
} as const satisfies Record<keyof ApplicationInput, string>;

/**
 * Checked against the trimmed value, so padding a value past the limit with
 * whitespace does not reject it - the stored value is what has to fit.
 */
function tooLong(field: keyof ApplicationInput, value: string | null): string | null {
  if (value === null || value.length <= APPLICATION_LIMITS[field]) {
    return null;
  }
  return `${FIELD_LABELS[field]} must be ${APPLICATION_LIMITS[field]} characters or fewer`;
}

export function validateApplicationInput(raw: RawApplicationInput): ValidationResult {
  const errors: ValidationErrors = {};

  const company = requiredText(raw.company);
  if (company === null) {
    errors.company = "Company is required";
  } else {
    const limit = tooLong("company", company);
    if (limit) {
      errors.company = limit;
    }
  }

  const position = requiredText(raw.position);
  if (position === null) {
    errors.position = "Position is required";
  } else {
    const limit = tooLong("position", position);
    if (limit) {
      errors.position = limit;
    }
  }

  const link = optionalText(raw.link);
  if (link === undefined || (link !== null && !isAcceptableLink(link))) {
    errors.link = "Link must be a full web address, like https://example.com/job";
  } else {
    // The length check comes second: a value that is not a URL at all is worth
    // saying so about, whatever its length.
    const limit = tooLong("link", link);
    if (limit) {
      errors.link = limit;
    }
  }

  const notes = optionalText(raw.notes);
  if (notes === undefined) {
    errors.notes = "Notes must be text";
  } else {
    const limit = tooLong("notes", notes);
    if (limit) {
      errors.notes = limit;
    }
  }

  if (
    company === null ||
    position === null ||
    link === undefined ||
    notes === undefined ||
    Object.keys(errors).length > 0
  ) {
    return { ok: false, errors };
  }

  return { ok: true, data: { company, position, link, notes } };
}
