/**
 * Signing a citizen out, as the one ordered sequence the shell's Sign out runs.
 *
 * The backend session ends first: `endSession` is DELETE /sessions, and the httpOnly
 * cookie that authorises it is present only until the local state is cleared and the
 * person leaves. `endSession` is safe to call when already signed out, so a network
 * error, an already-expired cookie, or sandbox mode with no backend must not strand the
 * person on an authed screen — whatever the backend answers, the local state is cleared
 * and the person leaves anyway.
 *
 * The steps are injected so this stays a plain, testable sequence: the citizen shell
 * wires its own auth service, profile provider, filing-session keys and router, and this
 * module never reaches across features to reach them (see `onSignOut` in `app-sidebar`).
 */

export type SignOutSteps = {
  /** End the backend session (DELETE /sessions). Safe to call when already signed out. */
  endSession: () => Promise<void>;
  /** Clear the demo profile hints, including the sign-in hint the guard reads. */
  clearProfile: () => void;
  /** Clear the litigant's session-lite filing keys that login set but logout missed. */
  clearFilingSession: () => void;
  /** Leave for the citizen sign-in, replacing history so Back cannot return to an authed view. */
  leave: () => void;
};

export async function signOutCitizen(steps: SignOutSteps): Promise<void> {
  try {
    await steps.endSession();
  } catch {
    // The person asked to leave; clear local state and go regardless of the backend's answer.
  }
  steps.clearProfile();
  steps.clearFilingSession();
  steps.leave();
}
