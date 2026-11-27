"use client";

import * as React from "react";

import { lookupPin, pinLookupFill } from "@/lib/filing/lookups";
import { STATES } from "@/lib/filing/options";
import type { Address } from "@/lib/filing/types";
import { FormRow } from "@/components/filing/form-card";
import { FormField } from "@/components/filing/form-field";
import { OptionSelect, TextField } from "@/components/filing/inputs";
import { LookupStatus } from "@/components/filing/lookup-status";
import { useTranslations } from "next-intl";

/** Wait after the sixth digit before asking the PIN service, so typing isn't chased. */
const PIN_DEBOUNCE_MS = 400;

/** What the PIN lookup filled on this address — cleared as soon as the person types over it. */
type PinFill = { pin: string; district: boolean; state: boolean };

/**
 * Address line · pincode · city · district · state.
 *
 * The pincode is the fast path: once six digits are in, the postal service is asked for
 * the district and state. On a first load those two fill only while blank, so a saved
 * address is left as it is; but *changing* the pincode to a different area refreshes both
 * to the new one (issue #58), since a changed pincode means the old district/state no
 * longer belong. A failed lookup says nothing — they just type.
 */
export function AddressFields({
  value,
  onChange,
  idPrefix,
  name,
  required = true,
  stateFirst = false,
}: {
  value: Address;
  onChange: (next: Address) => void;
  idPrefix?: string;
  /**
   * Where this address sits on its record ("res", "addresses.1.addr"), so a check on
   * one of its fields can point at it (`FormField name`). Changes nothing otherwise.
   */
  name?: string;
  /** False where the whole address is optional: no field is marked required. */
  required?: boolean;
  /**
   * Pincode · state, then city · district: the PIN's answers beside it, in the order a
   * court's witness form asks them (owner, 2026-10-28).
   */
  stateFirst?: boolean;
}) {
  const t = useTranslations();
  const key = (k: keyof Address) => (name ? `${name}.${k}` : undefined);
  const set = (k: keyof Address) => (v: string) => onChange({ ...value, [k]: v });

  const [pinFill, setPinFill] = React.useState<PinFill | null>(null);

  const pin6 = value.pin.replace(/\D/g, "");

  // The PIN whose area the district and state already reflect: seeded from the saved
  // address so a revisit's own lookup leaves it untouched, then moved forward each time a
  // lookup fills it. A lookup for a *different* PIN refreshes both fields (issue #58).
  const appliedPin = React.useRef<string | null>(pin6.length === 6 ? pin6 : null);

  // The lookup resolves after the fact, so it reads the newest address through a ref —
  // depending on it would restart the debounce on every key.
  const latest = React.useRef({ value, onChange });
  React.useEffect(() => {
    latest.current = { value, onChange };
  });

  React.useEffect(() => {
    if (pin6.length !== 6) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      lookupPin(pin6)
        .then((hit) => {
          if (cancelled || !hit) return;
          const { value: addr, onChange: commit } = latest.current;
          const fill = pinLookupFill(hit, addr, appliedPin.current, STATES);
          if (!fill) return;
          commit({ ...addr, district: fill.district, state: fill.state });
          appliedPin.current = hit.pin;
          setPinFill({ pin: hit.pin, district: fill.filled.district, state: fill.filled.state });
        })
        // Best-effort: an unknown PIN or an unreachable service says nothing.
        .catch(() => {});
    }, PIN_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [pin6]);

  /** Typing over a machine-filled district or state hands that field back to the person. */
  const setDistrict = (v: string) => {
    setPinFill((f) => (f ? { ...f, district: false } : null));
    onChange({ ...value, district: v });
  };
  const setState = (v: string) => {
    setPinFill((f) => (f ? { ...f, state: false } : null));
    onChange({ ...value, state: v });
  };

  // The caption belongs to the PIN still in the field; changing the PIN retires it.
  const shownFill = pinFill?.pin === pin6 ? pinFill : null;
  const filledLabel =
    shownFill?.district && shownFill.state
      ? t("addressFields_districtAndState")
      : shownFill?.district
        ? "District"
        : shownFill?.state
          ? "State"
          : null;

  const pinField = (
    <FormField label={t("addressFields_pincode")} name={key("pin")} required={required}>
      <TextField
        value={value.pin}
        onChange={set("pin")}
        placeholder="6-digit"
        inputMode="numeric"
        maxLength={6}
        autoComplete="postal-code"
      />
    </FormField>
  );
  const cityField = (
    <FormField label={t("addressFields_cityTown")} name={key("city")} required={required}>
      <TextField
        value={value.city}
        onChange={set("city")}
        placeholder={t("addressFields_cityOrTown")}
        autoComplete="address-level2"
      />
    </FormField>
  );
  const districtField = (
    <FormField label={t("addressFields_district")} name={key("district")} required={required}>
      <TextField
        value={value.district}
        onChange={setDistrict}
        placeholder={t("addressFields_district")}
      />
    </FormField>
  );
  const stateField = (
    <FormField label={t("addressFields_stateUt")} name={key("state")} required={required}>
      <OptionSelect
        value={value.state}
        onValueChange={setState}
        options={STATES}
        placeholder={t("addressFields_selectState")}
        /* The field's label does not reach a select's button; name it here. */
        ariaLabel={t("addressFields_stateUt")}
      />
    </FormField>
  );
  /* Mounted whether or not it has anything to say, so the fill is announced. */
  const lookupStatus = (
    <LookupStatus>
      {filledLabel && shownFill
        ? t("addressFields_filledLabelFilledFromPinPin", { filledLabel, pin: shownFill.pin })
        : null}
    </LookupStatus>
  );

  return (
    <div className="flex flex-col gap-4">
      <FormField label={t("addressFields_addressLine")} name={key("line1")} required={required}>
        <TextField
          id={idPrefix ? `${idPrefix}-line1` : undefined}
          value={value.line1}
          onChange={set("line1")}
          placeholder={t("addressFields_houseBuildingStreetArea")}
          autoComplete="address-line1"
        />
      </FormField>
      {stateFirst ? (
        <>
          <div className="flex flex-col gap-2">
            <FormRow>
              {pinField}
              {stateField}
            </FormRow>
            {lookupStatus}
          </div>
          <FormRow>
            {cityField}
            {districtField}
          </FormRow>
        </>
      ) : (
        <>
          {/* PIN first: it is the field that fills the two below it, so it comes before
              the ones it answers rather than after them. */}
          <FormRow>
            {pinField}
            {cityField}
          </FormRow>
          <div className="flex flex-col gap-2">
            <FormRow>
              {districtField}
              {stateField}
            </FormRow>
            {lookupStatus}
          </div>
        </>
      )}
    </div>
  );
}
