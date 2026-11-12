"use client";

import * as React from "react";

import { FormField } from "@/components/filing/form-field";
import { MobileInput } from "@/components/filing/inputs";
import { mobileIssue } from "@/lib/filing/selectors";

/**
 * A labelled mobile number field that says when the number cannot be an Indian mobile.
 * The message waits until the filer first leaves the field, so a half-typed number is not
 * called wrong, then follows the value so it clears as soon as it is fixed.
 */
export function MobileField({
  value,
  onChange,
  placeholder,
  ...field
}: Omit<React.ComponentProps<typeof FormField>, "children" | "error"> & {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const [left, setLeft] = React.useState(false);
  return (
    <FormField {...field} error={left ? mobileIssue(value) : undefined}>
      <MobileInput
        value={value}
        onChange={onChange}
        onBlur={() => setLeft(true)}
        placeholder={placeholder}
      />
    </FormField>
  );
}
