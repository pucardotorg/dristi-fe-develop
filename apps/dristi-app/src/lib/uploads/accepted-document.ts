/**
 * Which uploaded documents the app accepts: JPG, PNG or PDF, at most 10 MB — the rules
 * the backend applies to an ID document (dristi-be `apps/files/documents.py`,
 * `ACCEPTED_FORMATS` and `FILE_MAX_SIZE_BYTES`). Kept out of the upload component so it
 * can be tested without rendering anything.
 *
 * The file picker's `accept` attribute is only a hint (a phone can still pick a HEIC
 * photo or a Word file), so a picked file is checked here before it is sent.
 *
 * Not checked here: the backend also reads the file's first bytes, so a file renamed to
 * `.pdf` that is not a PDF passes this check and is refused on submit, with the
 * backend's message under the upload field.
 */

export const MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * Each accepted type and the extensions it may carry, as the backend pairs them. The
 * backend reads the type the browser declares; a file with none is sent as
 * `application/octet-stream` and refused, so an empty type is refused here too.
 */
const ACCEPTED_FORMATS: Record<string, readonly string[]> = {
  "application/pdf": [".pdf"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
};

/**
 * `"Scan.PDF"` → `".pdf"`; `""` when the name has none. Like Python's `os.path.splitext`,
 * which the backend uses, leading dots are not an extension: `".pdf"` has none.
 */
function extensionOf(name: string): string {
  const base = name.replace(/^\.+/, "");
  const dot = base.lastIndexOf(".");
  return dot === -1 ? "" : base.slice(dot).toLowerCase();
}

/** A JPG, PNG or PDF type with an extension that matches it, whatever the size. */
export function isAcceptedType(file: File): boolean {
  const extensions = ACCEPTED_FORMATS[file.type.toLowerCase()];
  return extensions !== undefined && extensions.includes(extensionOf(file.name));
}

/**
 * A file the upload field accepts: a JPG, PNG or PDF type, an extension that matches
 * that type, and at most `MAX_FILE_SIZE`.
 */
export function isAcceptedDocument(file: File): boolean {
  return isAcceptedType(file) && file.size <= MAX_FILE_SIZE;
}
