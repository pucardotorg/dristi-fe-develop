"use client";

import { CheckIcon, TriangleAlertIcon } from "lucide-react";

import { useFiling } from "@/lib/filing/store";
import { Spinner } from "@/components/ui/spinner";
import { useTranslations } from "next-intl";

/** "Saving… / Saved / Couldn't save" for the footer — reads the store's real write state. */
export function SavingIndicator() {
  const t = useTranslations();
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
          {t("savingIndicator_saving")}
        </>
      ) : saveState === "error" ? (
        <>
          <TriangleAlertIcon className="size-4 text-destructive-ink" aria-hidden />
          <span className="text-destructive-ink">{t("savingIndicator_couldntSaveRetrying")}</span>
        </>
      ) : (
        <>
          <CheckIcon className="size-4 text-success-ink" aria-hidden />
          <span className="text-success-ink">{t("savingIndicator_saved")}</span>
        </>
      )}
    </span>
  );
}
