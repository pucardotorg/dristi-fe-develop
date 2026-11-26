"use client";

/**
 * The autosave engine shared by every filing step.
 *
 * A step already knows how to push its records to the backend case (the `use-case-*` and
 * `use-*-evidence` hooks). Autosave is about *when*: as the filer fills a field and moves on,
 * not only on Continue. Two things make that safe to do on every blur:
 *
 *  - **One save at a time, newest wins.** A save started by leaving a field must never run in
 *    parallel with the one Continue starts — for a record with no id yet (a fresh cheque or
 *    notice), two parallel saves would POST it twice. `useSerialSave` runs one save at a time
 *    and collapses anything asked for while a save is running into a single trailing save with
 *    the newest data; every caller is handed that save's result. (Parties and advocates get
 *    the same guarantee from `runStepSave`, keyed per record, and so use `onBlurAutosave`
 *    directly on their already-serialized `sync`.)
 *  - **Skip when nothing changed.** Clicking through fields without editing, or opening a
 *    dropdown (its trigger blurs to the portalled list), must not re-send the step. `signature`
 *    returns a string standing for everything the save would send; equal to the last saved one
 *    means skip, and `null` means there is nothing to send yet.
 *
 * `onBlurAutosave` turns a save trigger into the one `onBlur` a step spreads on its form
 * wrapper (`FilingMain`). React's `onBlur` is a bubbling focusout, so the single handler fires
 * for every field within. Address blocks stop their own internal focus moves from reaching it
 * (`AddressFields`), so a multi-line address saves when the filer moves on from it rather than
 * once per line.
 */

import * as React from "react";

import { createCoalescingSave, runKeyedSave, type SaveResult } from "./autosave-queue";
import { caseFilingErrorMessage } from "./data/cases-api";

export type { SaveResult };

/** Props a step spreads on its form wrapper so leaving any field saves the step. */
export type AutosaveProps = { onBlur: React.FocusEventHandler };

/** Fire `trigger` whenever focus leaves a field inside the wrapper. */
export function onBlurAutosave(trigger: () => void): AutosaveProps {
  return { onBlur: () => trigger() };
}

/**
 * Wrap a step's save so it runs one at a time, collapses overlapping calls into a single
 * trailing save, and is skipped when its `signature` is unchanged since the last save that
 * stuck (or `null`). `fn` reports failure as `{ ok: false }` rather than throwing; an
 * unexpected throw is still caught so the queue never wedges.
 *
 * The queue lives inside this component, which suits a step whose save is idempotent (a
 * section PUT, the affidavit). A step that creates rows with no id — cheques, notices —
 * needs the queue to outlive the step unmounting, so it uses `useKeyedSerialSave` instead.
 */
export function useSerialSave(
  fn: () => Promise<SaveResult>,
  signature: () => string | null,
): () => Promise<SaveResult> {
  const fnRef = React.useRef(fn);
  const signatureRef = React.useRef(signature);
  const lastSavedSignature = React.useRef<string | null>(null);
  React.useEffect(() => {
    fnRef.current = fn;
    signatureRef.current = signature;
  });

  // The coalescer holds the queue's running/trailing state, so it is built once and kept. It
  // is built in an effect, not during render, because its one pass reads the refs above — the
  // newest `fn`/`signature` and the last-saved signature — and those reads must stay out of
  // render. A save fired before the effect runs is a no-op; the filer cannot act that early.
  const coalescedRef = React.useRef<(() => Promise<SaveResult>) | null>(null);
  React.useEffect(() => {
    coalescedRef.current = createCoalescingSave(async () => {
      try {
        const sig = signatureRef.current();
        // Nothing to send yet, or unchanged since the last save that stuck.
        if (sig === null || sig === lastSavedSignature.current) return { ok: true };
        const result = await fnRef.current();
        if (result.ok) lastSavedSignature.current = sig;
        return result;
      } catch (error) {
        return { ok: false, error: caseFilingErrorMessage(error) };
      }
    });
  }, []);

  return React.useCallback(() => coalescedRef.current?.() ?? Promise.resolve({ ok: true }), []);
}

/**
 * Like `useSerialSave`, but the queue and its last-saved signature live at module scope under
 * `keyOf()` — a case and
 * step — so they survive the step unmounting: a save left running when the filer leaves the
 * step never runs in parallel with one the step starts when they come back, which for a row
 * with no id yet would create it twice (`runKeyedSave`). `keyOf` returning `null` (no case to
 * save to yet) means there is nothing to save.
 */
export function useKeyedSerialSave(
  keyOf: () => string | null,
  fn: () => Promise<SaveResult>,
  signature: () => string | null,
): () => Promise<SaveResult> {
  const keyOfRef = React.useRef(keyOf);
  const fnRef = React.useRef(fn);
  const signatureRef = React.useRef(signature);
  React.useEffect(() => {
    keyOfRef.current = keyOf;
    fnRef.current = fn;
    signatureRef.current = signature;
  });

  return React.useCallback(() => {
    const key = keyOfRef.current();
    if (key === null) return Promise.resolve({ ok: true });
    return runKeyedSave(
      key,
      () => fnRef.current(),
      () => signatureRef.current(),
    );
  }, []);
}
