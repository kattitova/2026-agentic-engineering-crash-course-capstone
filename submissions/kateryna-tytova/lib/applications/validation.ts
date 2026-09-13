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

function requiredText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
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
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function isHttpUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

export function validateApplicationInput(raw: RawApplicationInput): ValidationResult {
  const errors: ValidationErrors = {};

  const company = requiredText(raw.company);
  if (company === null) {
    errors.company = "Company is required";
  }

  const position = requiredText(raw.position);
  if (position === null) {
    errors.position = "Position is required";
  }

  const link = optionalText(raw.link);
  if (link === undefined || (link !== null && !isHttpUrl(link))) {
    errors.link = "Link must be a valid http(s) URL";
  }

  const notes = optionalText(raw.notes);
  if (notes === undefined) {
    errors.notes = "Notes must be text";
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
