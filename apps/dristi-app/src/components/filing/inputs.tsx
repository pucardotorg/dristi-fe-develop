"use client";

import * as React from "react";
import { toNationalMobile } from "@/lib/auth/mobile";
import type { Option } from "@/lib/filing/options";
import { cn } from "@/lib/utils";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useFieldReadOnly,
  useFieldReadOnlyHint,
  useLockedDisabled,
} from "@/components/filing/posture";

/**
 * A flagged field's value, shown but not editable — for the controls that have no
 * read-only state of their own (a Select, a date picker, a segmented answer). The DS
 * `Input` does have one, so this is the primitive in its read-only mode rather than a
 * box built to look like it, and it stays focusable, selectable and announced.
 */
export function ReadOnlyValue({
  value,
  id,
  ariaLabel,
  className,
}: {
  value: string;
  id?: string;
  ariaLabel?: string;
  className?: string;
}) {
  const hint = useFieldReadOnlyHint();
  return (
    <Input
      id={id}
      readOnly
      value={value}
      aria-label={ariaLabel}
      aria-describedby={hint}
      className={cn("w-full", className)}
    />
  );
}

/** Text input for a filing field, aware of a locked or flagged (read-only) posture. */
export function TextField({
  value,
  onChange,
  className,
  ...props
}: Omit<React.ComponentProps<typeof Input>, "value" | "onChange" | "prefilled"> & {
  value: string;
  onChange: (value: string) => void;
}) {
  const disabled = useLockedDisabled(props.disabled);
  /* Flagged by scrutiny: the value stays legible and focusable, and is corrected in the
     inset beneath the field rather than typed over here (brief §15.2). */
  const readOnly = useFieldReadOnly();
  const hint = useFieldReadOnlyHint();
  return (
    <Input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-describedby={hint}
      className={className}
      {...props}
      readOnly={readOnly || props.readOnly}
      disabled={disabled}
    />
  );
}

/** Input with a fixed prefix — "+91" for mobiles, "₹" for amounts. */
export function PrefixInput({
  prefix,
  value,
  onChange,
  className,
  ...props
}: Omit<React.ComponentProps<"input">, "value" | "onChange" | "prefix"> & {
  prefix: React.ReactNode;
  value: string;
  onChange: (value: string) => void;
}) {
  const disabled = useLockedDisabled(props.disabled);
  const readOnly = useFieldReadOnly();
  const hint = useFieldReadOnlyHint();
  return (
    <InputGroup
      data-disabled={disabled || undefined}
      className={cn(
        /* Locked: the same quiet sunken fill as every other locked control — the `!`
           outranks the group's own `has-disabled:bg-input/50` (the correction screen
           restores full opacity; see its centre pane). */
        disabled && "bg-surface-sunken!",
        readOnly && "bg-muted",
        className
      )}
    >
      <InputGroupAddon variant="field">
        <InputGroupText>{prefix}</InputGroupText>
      </InputGroupAddon>
      <InputGroupInput
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-describedby={hint}
        {...props}
        readOnly={readOnly || props.readOnly}
        disabled={disabled}
      />
    </InputGroup>
  );
}

/**
 * A +91 mobile: digits only, never more than ten. No `maxLength`, which would cut a pasted
 * "+91 98765 43210" to its first ten characters before the country code is dropped.
 */
export function MobileInput({
  placeholder = "10-digit number",
  onChange,
  ...props
}: Omit<React.ComponentProps<typeof PrefixInput>, "prefix">) {
  return (
    <PrefixInput
      prefix="+91"
      inputMode="numeric"
      autoComplete="tel-national"
      placeholder={placeholder}
      onChange={(v) => onChange(toNationalMobile(v))}
      {...props}
    />
  );
}

/** Select over an `Option[]` with a placeholder row. */
export function OptionSelect({
  value,
  onValueChange,
  options,
  placeholder = "Select",
  disabled,
  ariaLabel,
  className,
  id,
}: {
  value: string;
  onValueChange: (value: string) => void;
  options: Option[] | string[];
  placeholder?: string;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
  id?: string;
}) {
  const opts: Option[] = options.map((o) =>
    typeof o === "string" ? { value: o, label: o } : o
  );
  const isDisabled = useLockedDisabled(disabled);
  const readOnly = useFieldReadOnly();
  /* A Select has no read-only state — a flagged one therefore shows its chosen option as
     a read-only value (brief §15.5, "rendered as text where the control type cannot be
     read-only"). Focusable and announced; simply not re-openable. */
  if (readOnly) {
    const chosen = opts.find((o) => o.value === value);
    return (
      <ReadOnlyValue
        id={id}
        value={chosen?.label ?? value}
        ariaLabel={ariaLabel}
        className={className}
      />
    );
  }
  return (
    <Select value={value || undefined} onValueChange={onValueChange} disabled={isDisabled}>
      <SelectTrigger id={id} aria-label={ariaLabel} className={cn("w-full", className)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      {/*
        The DS default is `item-aligned`, which lays the open list over the trigger — on a
        form card that reads as the menu having eaten the label and the field below it.
        Inside a form a menu belongs under the control it belongs to, at its width.
      */}
      <SelectContent position="popper" align="start" sideOffset={4} className="w-(--radix-select-trigger-width)">
        {opts.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * A field whose list is too long to scan — police stations, a bar register — so it is
 * typed into and filtered rather than scrolled.
 *
 * It stays open: anything typed is kept whether or not the list has it. These registers
 * are never complete, and a form that refuses an address because its station is missing
 * from our copy of the directory is worse than one that takes the person's word for it.
 */
export function ComboField({
  value,
  onChange,
  items,
  onSelect,
  placeholder = "Search or type",
  emptyLabel = "No match. What you typed is kept.",
  renderItem,
  itemKey = (item) => String(item),
  itemLabel = (item) => String(item),
  /**
   * `undefined` (default) leaves Base UI's own matching in place — it checks the typed
   * text against `itemToStringLabel`, which is right for a field with one thing to match
   * on (a police station's name). `null` turns internal matching off entirely: use this
   * when `items` already *is* the matched set, e.g. handed down from an async search that
   * matched on more than the one string this field displays (a name search that has to
   * find rows by registration number too, or the reverse).
   */
  filter,
  disabled,
  ariaLabel,
  id,
}: {
  value: string;
  onChange: (value: string) => void;
  items: readonly unknown[];
  /** Fired only when a row is picked, so a screen can fill sibling fields from it. */
  onSelect?: (item: unknown) => void;
  placeholder?: string;
  emptyLabel?: string;
  renderItem?: (item: unknown) => React.ReactNode;
  itemKey?: (item: unknown) => string;
  itemLabel?: (item: unknown) => string;
  filter?: null;
  disabled?: boolean;
  ariaLabel?: string;
  id?: string;
}) {
  const locked = useLockedDisabled(disabled);
  const readOnly = useFieldReadOnly();
  if (readOnly) {
    return <ReadOnlyValue id={id} value={value} ariaLabel={ariaLabel} />;
  }
  return (
    <Combobox
      items={items as unknown[]}
      itemToStringLabel={(item) => itemLabel(item)}
      filter={filter}
      inputValue={value}
      onInputValueChange={(text) => onChange(text)}
      onValueChange={(item) => {
        if (item == null) return;
        onChange(itemLabel(item));
        onSelect?.(item);
      }}
      disabled={locked}
    >
      <ComboboxInput
        id={id}
        aria-label={ariaLabel}
        placeholder={placeholder}
        className="w-full"
        autoComplete="off"
      />
      {/* pointer-events-auto: a Radix modal dialog puts pointer-events:none
          on the body, which swallowed this portalled popup when the field
          is used inside one (the witness dialog) — the same fix the
          advocate join dialog's combobox carries. No effect on the filing
          pages, which have no modal. */}
      <ComboboxContent className="pointer-events-auto">
        <ComboboxEmpty>{emptyLabel}</ComboboxEmpty>
        <ComboboxList>
          {(item: unknown) => (
            <ComboboxItem key={itemKey(item)} value={item}>
              {renderItem ? renderItem(item) : itemLabel(item)}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
