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
