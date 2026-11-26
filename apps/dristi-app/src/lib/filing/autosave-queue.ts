/**
 * The serialization at the heart of autosave, with no React or network in it so it can be
 * tested on its own.
 *
 * A step saves as the filer leaves each field, and also on Continue. Those must never run in
 * parallel: for a record with no id yet (a fresh cheque, notice or party) two parallel saves
 * would create it twice. `createCoalescingSave` runs one save pass at a time and collapses
 * anything asked for while a pass is running into a single trailing pass carrying the newest
 * data — the first caller is handed the running pass's result, everyone who arrived mid-save
 * gets the trailing pass's.
 */

export type SaveResult = { ok: boolean; error?: string };

/**
 * Wrap `perform` (one save pass) with the one-at-a-time, newest-wins behaviour above.
 * `perform` reports failure as `{ ok: false }` rather than throwing.
 */
export function createCoalescingSave(
  perform: () => Promise<SaveResult>,
): () => Promise<SaveResult> {
  let running = false;
  let trailing: { promise: Promise<SaveResult>; resolve: (result: SaveResult) => void } | null =
    null;

  const pump = (): Promise<SaveResult> =>
    perform().then((result) => {
      const pending = trailing;
      if (!pending) {
        running = false;
        return result;
      }
      // Run once more for the callers that arrived mid-save, and hand them that result.
      trailing = null;
      return pump().then((next) => {
        pending.resolve(next);
        return result;
      });
    });

  return () => {
    if (running) {
      if (!trailing) {
        let resolve!: (result: SaveResult) => void;
        const promise = new Promise<SaveResult>((r) => {
          resolve = r;
        });
        trailing = { promise, resolve };
      }
      return trailing.promise;
    }
    running = true;
    return pump();
  };
}

/**
 * A coalescing save kept at module scope under a key (a case + step), so it outlives the
 * React step that drives it.
 *
 * A step's save queue must survive the filer leaving the step and coming back: otherwise a
 * save started before they left and one started after they return run in parallel, and for a
 * record with no id yet (a fresh cheque or notice) that creates it twice. The parties keep
 * their queue at module scope for the same reason (`runStepSave`); this gives the evidence
 * steps the same guarantee. Each key also remembers its last-saved signature — so clicking
 * back through an unchanged step re-sends nothing — and the save currently running, so a
 * removal can wait for it (`awaitKeyedSave`) before taking a row off the case.
 */
type KeyedSaveEntry = {
  perform: () => Promise<SaveResult>;
  signature: () => string | null;
  lastSignature: string | null;
  trigger: () => Promise<SaveResult>;
  pending: Promise<SaveResult> | null;
};

const keyedSaves = new Map<string, KeyedSaveEntry>();

function keyedSaveEntry(key: string): KeyedSaveEntry {
  const existing = keyedSaves.get(key);
  if (existing) return existing;
  const entry: KeyedSaveEntry = {
    perform: () => Promise.resolve({ ok: true }),
    signature: () => null,
    lastSignature: null,
    pending: null,
    trigger: () => Promise.resolve({ ok: true }),
  };
  const coalesced = createCoalescingSave(async () => {
    const sig = entry.signature();
    // Nothing to send yet, or unchanged since the last save that stuck.
    if (sig === null || sig === entry.lastSignature) return { ok: true };
    const result = await entry.perform();
    if (result.ok) entry.lastSignature = sig;
    return result;
  });
  entry.trigger = () => {
    const promise = coalesced();
    entry.pending = promise;
    const settle = () => {
      if (entry.pending === promise) entry.pending = null;
    };
    promise.then(settle, settle);
    return promise;
  };
  keyedSaves.set(key, entry);
  return entry;
}

/**
 * Register the newest `perform` and `signature` for `key` and run a coalescing save now.
 * One save runs at a time per key; a call made while one is running collapses into a single
 * trailing pass with the newest data (see `createCoalescingSave`).
 */
export function runKeyedSave(
  key: string,
  perform: () => Promise<SaveResult>,
  signature: () => string | null,
): Promise<SaveResult> {
  const entry = keyedSaveEntry(key);
  entry.perform = perform;
  entry.signature = signature;
  return entry.trigger();
}

/**
 * Wait for a save currently running for `key`, if any — used before removing one of its
 * rows, so a row the running save is still creating is taken off the case rather than left
 * behind. The save reports its own failure; a rejection here is swallowed so removal goes on.
 */
export async function awaitKeyedSave(key: string): Promise<void> {
  const pending = keyedSaves.get(key)?.pending;
  if (!pending) return;
  try {
    await pending;
  } catch {
    // Ignored on purpose: the save surfaces its own error to the filer.
  }
}
