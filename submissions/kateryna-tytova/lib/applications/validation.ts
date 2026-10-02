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
 * trimming. 2048 is the conventional ceiling for a URL; the shorter limits are
 * a guard against unbounded input rather than a guess at the longest real name.
 */
export const APPLICATION_LIMITS = {
  company: 120,
  position: 120,
  link: 2048,
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

/** Exported so the render path can re-check a stored value it did not write. */
export function isAcceptableLink(value: string): boolean {
  try {
    const { protocol } = new URL(value);
    return protocol === "http:" || protocol === "https:";
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
    errors.link = "Link must be a valid http(s) URL";
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
