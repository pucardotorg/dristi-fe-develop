"use client";

/**
 * The Continue action shared by the e-filing steps whose save is explicit (cheque, demand
 * notice, the details sections, the affidavit).
 *
 * Every one of those steps did the same thing on Continue: show a pending label, save the
 * step, and move on only if the save stuck. It drives the button from its own `continuing`
 * flag — never the hook's autosave state — because clicking Continue blurs the focused field,
 * which autosaves, and a button disabled by that mid-click would swallow the click.
 */

import * as React from "react";
import { useRouter } from "next/navigation";

import type { SaveResult } from "./use-autosave";

export type UseContinue = {
  /** True while the Continue save is in flight — for the button's disabled state and label. */
  continuing: boolean;
  /** Save the step, then navigate to `continueHref` if it stuck. */
  onContinue: () => Promise<void>;
};

/**
 * `save` runs the step's save (returning whether it stuck); `continueHref` is where Continue
 * goes next, or `undefined` when the step is last. Both are read through refs, so the handler
 * stays stable while always using the newest closure (the affidavit's `save` closes over the
 * current editor text).
 */
export function useContinue(
  save: () => Promise<SaveResult>,
  continueHref: string | undefined,
): UseContinue {
  const router = useRouter();
  const [continuing, setContinuing] = React.useState(false);

  const saveRef = React.useRef(save);
  const hrefRef = React.useRef(continueHref);
  React.useEffect(() => {
    saveRef.current = save;
    hrefRef.current = continueHref;
  });

  const onContinue = React.useCallback(async () => {
    setContinuing(true);
    try {
      const result = await saveRef.current();
      if (result.ok && hrefRef.current) router.push(hrefRef.current);
    } finally {
      setContinuing(false);
    }
  }, [router]);

  return { continuing, onContinue };
}
