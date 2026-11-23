import { isNotIntegratedError } from "@/lib/data/source";

/** Why the tasks could not be loaded, as the screen shows it. */
export type LoadFailure = {
  message: string;
  /**
   * The backend doesn't answer one of the reads yet. That is a known state, not a failure:
   * trying again gets the same answer, so the screen offers no retry.
   */
  notConnected: boolean;
};

export function loadFailure(error: unknown, fallback: string): LoadFailure {
  return {
    message: error instanceof Error ? error.message : fallback,
    notConnected: isNotIntegratedError(error),
  };
}
