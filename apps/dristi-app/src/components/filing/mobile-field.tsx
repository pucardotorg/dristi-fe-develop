"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { FormField } from "@/components/filing/form-field";
import { MobileInput } from "@/components/filing/inputs";
import type { MobileOwner } from "@/lib/filing/mobile-conflicts";
import { advocateMobileIssue, mobileIssue } from "@/lib/filing/selectors";

type MobileFieldProps = Omit<React.ComponentProps<typeof FormField>, "children" | "error"> & {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** The filing advocate's own number, which a party's number must not be. */
  advocateMobile?: string;
  /** Another party already has this number (see `mobile-conflicts.ts`). */
  conflict?: string;
};

/**
 * A labelled mobile number field that says when the number cannot be an Indian mobile.
 * The message waits until the filer first leaves the field, so a half-typed number is not
 * called wrong, then follows the value so it clears as soon as it is fixed. The advocate's
 * own number and `conflict` (another party already has the number) show at once: both only
 * ever match a full number.
 */
export function MobileField({
  value,
  onChange,
  placeholder,
  advocateMobile,
  conflict,
  ...field
}: MobileFieldProps) {
  const [left, setLeft] = React.useState(false);
  const error =
    advocateMobileIssue(value, advocateMobile) ??
    (left ? mobileIssue(value) : undefined) ??
    conflict;
  return (
    <FormField {...field} error={error}>
      <MobileInput
        value={value}
        onChange={onChange}
        onBlur={() => setLeft(true)}
        placeholder={placeholder}
      />
    </FormField>
  );
}

/**
 * Words for the party a number clashes with, from the side of a PoA holder's field or not.
 * A clash shows only on the later party's field, so the number is always an earlier
 * complainant's, an accused's or an earlier witness's.
 */
export function useMobileConflictMessage() {
  const t = useTranslations();
  return (other: MobileOwner | undefined, onPoaHolderField = false): string | undefined => {
    if (other?.role === "accused") {
      return t("mobileConflict_accused", { number: String(other.accused + 1) });
    }
    if (other?.role === "witness") {
      return t("mobileConflict_witness", { number: String(other.witness + 1) });
    }
    if (other?.role !== "complainant") return undefined;
    return onPoaHolderField
      ? t("mobileConflict_ownComplainant")
      : t("mobileConflict_complainant", { number: String(other.complainant + 1) });
  };
}
