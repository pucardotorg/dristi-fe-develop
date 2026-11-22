"use client";

import * as React from "react";

import { FormField } from "@/components/filing/form-field";
import { MobileInput } from "@/components/filing/inputs";
import { advocateMobileIssue, mobileIssue } from "@/lib/filing/selectors";

type MobileFieldProps = Omit<React.ComponentProps<typeof FormField>, "children" | "error"> & {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** The filing advocate's own number, which a party's number must not be. */
  advocateMobile?: string;
};

/**
 * A labelled mobile number field that says when the number cannot be an Indian mobile.
 * The message waits until the filer first leaves the field, so a half-typed number is not
 * called wrong, then follows the value so it clears as soon as it is fixed. The advocate's
 * own number is complete when it matches, so that shows at once — a prefilled one too.
 */
export function MobileField({
  value,
  onChange,
  placeholder,
  advocateMobile,
  ...field
}: MobileFieldProps) {
  const [left, setLeft] = React.useState(false);
  const error =
    advocateMobileIssue(value, advocateMobile) ?? (left ? mobileIssue(value) : undefined);
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
