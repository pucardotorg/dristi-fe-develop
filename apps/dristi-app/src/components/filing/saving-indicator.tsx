"use client";
import {LocalizedText as __LocalizedText} from "@/components/localized-text";

import { CheckIcon, TriangleAlertIcon } from "lucide-react";

import { useFiling } from "@/lib/filing/store";
import { Spinner } from "@/components/ui/spinner";

/** "Saving… / Saved / Couldn't save" for the footer — reads the store's real write state. */
export function SavingIndicator() {
    const { saveState } = useFiling();
  return (
    <span
      role="status"
      aria-live="polite"
      className="inline-flex items-center gap-1.5 text-body-compact text-muted-foreground"
    >
      {saveState === "saving" ? (
        <>
          <Spinner className="size-4" />
          {<__LocalizedText id="savingIndicator_saving" />}{" "}</>
      ) : saveState === "error" ? (
        <>
          <TriangleAlertIcon className="size-4 text-destructive-ink" aria-hidden />
          <span className="text-destructive-ink">{<__LocalizedText id="savingIndicator_couldnTSaveRetrying" />}</span>
        </>
      ) : (
        <>
          <CheckIcon className="size-4 text-success-ink" aria-hidden />
          <span className="text-success-ink">{<__LocalizedText id="savingIndicator_saved" />}</span>
        </>
      )}
    </span>
  );
}
