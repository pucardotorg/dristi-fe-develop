import { pick, type Locale } from "@/lib/onboarding/content";
import { verificationUi } from "./content";

export const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Longest registration number the backend stores (bar ID / clerk number). */
export const REGISTRATION_NUMBER_MAX = 64;

/** The backend's own per-field messages from its last refusal. */
export type ServerFieldErrors = Partial<
  Record<"name" | "email" | "password" | "regNumber" | "idFile", string>
>;

/** Why the picked ID file cannot be sent: the pick was refused here, or the server said too large. */
export type FileProblem = "rejected" | "tooLarge";

/**
 * What to say under the ID upload. The server's own reason wins (it reads the file's
 * contents); then a refused pick; then the missing-file prompt once the form was tried.
 */
export function idFileError({
  serverError,
  fileProblem,
  missingMessage,
  locale,
}: {
  serverError: string | undefined;
  fileProblem: FileProblem | null;
  /** Shown when the form was submitted without a file; null before that. It differs
   *  by role ("Upload your Bar Council ID" / "Upload your clerk ID"). */
  missingMessage: string | null;
  locale: Locale;
}): string | null {
  if (serverError) return serverError;
  if (fileProblem) {
    return pick(
      fileProblem === "tooLarge" ? verificationUi.fileTooLargeForServer : verificationUi.fileRejected,
      locale,
    );
  }
  return missingMessage;
}
