"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { FormField } from "@/components/filing/form-field";
import { MobileInput } from "@/components/filing/inputs";
import type { MobileOwner } from "@/lib/filing/mobile-conflicts";
import { mobileIssue } from "@/lib/filing/selectors";

/**
 * A labelled mobile number field that says when the number cannot be an Indian mobile.
 * The message waits until the filer first leaves the field, so a half-typed number is not
 * called wrong, then follows the value so it clears as soon as it is fixed. `conflict`
 * (another party already has the number) shows at once: it only ever names a full number.
 */
export function MobileField({
  value,
  onChange,
  placeholder,
  conflict,
  ...field
}: Omit<React.ComponentProps<typeof FormField>, "children" | "error"> & {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  conflict?: string;
}) {
  const [left, setLeft] = React.useState(false);
  return (
    <FormField {...field} error={(left ? mobileIssue(value) : undefined) ?? conflict}>
      <MobileInput
        value={value}
        onChange={onChange}
        onBlur={() => setLeft(true)}
        placeholder={placeholder}
      />
    </FormField>
  );
}

/** Words for the party a number clashes with, from the side of a PoA holder's field or not. */
export function useMobileConflictMessage() {
  const t = useTranslations();
  return (other: MobileOwner | undefined, onPoaHolderField = false): string | undefined => {
    if (!other) return undefined;
    if (other.role === "poa-holder") return t("mobileConflict_ownPoaHolder");
    if (other.role === "accused") {
      return t("mobileConflict_accused", { number: String(other.accused + 1) });
    }
    return onPoaHolderField
      ? t("mobileConflict_ownComplainant")
      : t("mobileConflict_complainant", { number: String(other.complainant + 1) });
  };
}
