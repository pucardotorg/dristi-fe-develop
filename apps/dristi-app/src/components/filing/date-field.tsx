"use client";

import * as React from "react";

import { dateToIso, isoToDate, toDisplayDate } from "@/lib/filing/format";
import type { ISODate } from "@/lib/filing/types";
import { cn } from "@/lib/utils";
import { DatePicker } from "@/components/ui/date-picker";
import { useFieldReadOnly, useLockedDisabled } from "@/components/filing/posture";
import { ReadOnlyValue } from "@/components/filing/inputs";
import { useTranslations } from "next-intl";
import { translateText } from "@/i18n/translate-text";

/** Date control bound to an ISO string, picked with the DS DatePicker. */
export function DateField({
  value,
  onChange,
  placeholder = "dateField_pickDate",
  ariaLabel,
  className,
  id,
}: {
  value: ISODate;
  onChange: (iso: ISODate) => void;
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
  id?: string;
}) {
  const t = useTranslations();
  const disabled = useLockedDisabled();
  const readOnly = useFieldReadOnly();
  /* Flagged by scrutiny: a date picker has no read-only state, so the date reads as a
     value and the correction is made in the inset beneath it (brief §15.5). */
  if (readOnly) {
    return (
      <ReadOnlyValue
        id={id}
        value={toDisplayDate(value) || ""}
        ariaLabel={ariaLabel}
        className={className}
      />
    );
  }
  return (
    <DatePicker
      // Always controlled: an empty date must stay empty, not show the last date this
      // picker held when the form switches to another cheque or party.
      value={isoToDate(value) ?? null}
      onValueChange={(d) => onChange(dateToIso(d))}
      disabled={disabled}
      placeholder={translateText(t, placeholder)}
      /* Locked in a correction round: the same quiet sunken fill as every other locked
         control (the correction screen restores full opacity; see its centre pane). */
      className={cn("w-full", disabled && "disabled:bg-surface-sunken", className)}
    />
  );
}
