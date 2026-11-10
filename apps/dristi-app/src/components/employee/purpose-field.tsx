"use client";
import {useTranslations as __useTranslations} from "@/i18n/use-translations";
import {LocalizedText as __LocalizedText} from "@/components/localized-text";

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import {
  COURT_HEARING_PURPOSES,
  type CourtHearingPurposeId,
} from "@/lib/employee/hearings";

type Purpose = (typeof COURT_HEARING_PURPOSES)[number];

/**
 * The next hearing's purpose, picked from the court's list by typing part of it.
 *
 * A strict picker, unlike the filing `ComboField`: only a listed purpose can be chosen,
 * and what was typed without picking is dropped when the field closes. Every screen that
 * sets a listing purpose uses this one, so the list reads and filters the same in each.
 */
export function PurposeField({
  value,
  onChange,
  disabled,
  placeholder = "Choose a purpose",
  id,
  ariaLabel,
  labelledBy,
}: {
  value: CourtHearingPurposeId | "" | null | undefined;
  onChange: (value: CourtHearingPurposeId) => void;
  disabled?: boolean;
  placeholder?: string;
  id?: string;
  ariaLabel?: string;
  labelledBy?: string;
}) {
  const __t = __useTranslations();
  const selected = COURT_HEARING_PURPOSES.find((entry) => entry.id === value) ?? null;
  return (
    <Combobox
      items={COURT_HEARING_PURPOSES}
      value={selected}
      itemToStringLabel={(item: Purpose) => item.label}
      isItemEqualToValue={(item: Purpose, other: Purpose) => item.id === other.id}
      onValueChange={(item: Purpose | null) => {
        if (item) onChange(item.id);
      }}
      disabled={disabled}
    >
      <ComboboxInput
        id={id}
        aria-label={labelledBy ? undefined : __t(ariaLabel)}
        aria-labelledby={labelledBy}
        placeholder={__t(placeholder)}
        disabled={disabled}
        className="w-full"
        autoComplete="off"
      />
      {/* pointer-events-auto: a Radix modal dialog sets pointer-events:none on the body,
          which would swallow this portalled popup inside the hearing dialog. */}
      <ComboboxContent className="pointer-events-auto">
        <ComboboxEmpty>{<__LocalizedText id="purposeField_noPurposeMatches" />}</ComboboxEmpty>
        <ComboboxList>
          {(item: Purpose) => (
            <ComboboxItem key={item.id} value={item}>
              {__t(item.label)}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
