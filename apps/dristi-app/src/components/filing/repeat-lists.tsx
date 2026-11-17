"use client";

import * as React from "react";
import { PlusIcon, Trash2Icon } from "lucide-react";

import { blankAddressBlock, blankContact, blankRepresentative } from "@/lib/filing/blank";
import { useCourt } from "@/components/court/court-provider";
import { policeStationsFor } from "@/lib/filing/options";
import type { AddressBlock, Contact, Representative } from "@/lib/filing/types";
import { Button } from "@/components/ui/button";
import { AddressFields } from "@/components/filing/address-fields";
import { FormRow, FormSubhead, HalfWidth } from "@/components/filing/form-card";
import { FormField } from "@/components/filing/form-field";
import { ComboField, TextField } from "@/components/filing/inputs";
import { MobileField } from "@/components/filing/mobile-field";
import { useTranslations } from "next-intl";
import { translateText } from "@/i18n/translate-text";

/** Icon-only remove control at the 40px floor. */
export function RemoveButton({
  label,
  onClick,
  className,
}: {
  label: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={label}
      onClick={onClick}
      className={className}
    >
      <Trash2Icon aria-hidden />
    </Button>
  );
}

/** Mobile + email rows with add / remove — used for accused and witness contacts. */
export function ContactList({
  contacts,
  onChange,
  addLabel = "repeatLists_addAnotherContact",
  emailLabel = "repeatLists_emailAddress",
  mobilePlaceholder = "10-digit number",
  emailPlaceholder = "name@example.com",
  optional = false,
  allowAdd = true,
}: {
  contacts: Contact[];
  onChange: (next: Contact[]) => void;
  addLabel?: string;
  emailLabel?: string;
  mobilePlaceholder?: string;
  emailPlaceholder?: string;
  /** Marks the mobile and email labels optional — the marker sits on the fields,
      not on the section heading (owner, Sept 2). */
  optional?: boolean;
  /** False hides the add-row control; a single contact row is enough. */
  allowAdd?: boolean;
}) {
  const t = useTranslations();
  const setAt = (i: number, patch: Partial<Contact>) =>
    onChange(contacts.map((c, k) => (k === i ? { ...c, ...patch } : c)));
  return (
    <div className="flex flex-col gap-4">
      {contacts.map((c, i) => (
        <div key={i} className="flex items-end gap-3">
          <FormRow className="flex-1">
            <MobileField
              label={t("repeatLists_mobileNumber")}
              name={`contacts.${i}.mobile`}
              optional={optional}
              value={c.mobile}
              onChange={(v) => setAt(i, { mobile: v })}
              placeholder={mobilePlaceholder}
            />
            <FormField
              label={translateText(t, emailLabel)}
              name={`contacts.${i}.email`}
              optional={optional}
            >
              <TextField
                type="email"
                value={c.email}
                onChange={(v) => setAt(i, { email: v })}
                placeholder={emailPlaceholder}
                autoComplete="email"
              />
            </FormField>
          </FormRow>
          {contacts.length > 1 ? (
            <RemoveButton
              label={t("repeatLists_removeContactValue", { value: String(i + 1) })}
              onClick={() => onChange(contacts.filter((_, k) => k !== i))}
            />
          ) : null}
        </div>
      ))}
      {allowAdd ? (
        <Button
          type="button"
          variant="outline"
          className="w-fit"
          onClick={() => onChange([...contacts, blankContact()])}
        >
          <PlusIcon data-icon="inline-start" aria-hidden />
          {translateText(t, addLabel)}
        </Button>
      ) : null}
    </div>
  );
}

/**
 * "Address N" blocks: address fields and the police station the address falls under.
 *
 * The latitude/longitude field that used to sit beside the station is gone. Nobody knows
 * their own coordinates, there is no map picker to read them off, and a process server
 * navigates by the address — it asked for work no one could do (owner, 2026-08-19).
 */
export function AddressBlockList({
  blocks,
  onChange,
  addLabel = "repeatLists_addAnotherAddress",
  optional = false,
}: {
  blocks: AddressBlock[];
  onChange: (next: AddressBlock[]) => void;
  addLabel?: string;
  /** No address is needed: the last one can be removed too, and no field is marked
      required (a started address still has to be complete; the host says so). */
  optional?: boolean;
}) {
  const t = useTranslations();
  const { court } = useCourt();
  const setAt = (i: number, patch: Partial<AddressBlock>) =>
    onChange(blocks.map((b, k) => (k === i ? { ...b, ...patch } : b)));

  return (
    <div className="flex flex-col gap-4">
      {blocks.map((b, i) => (
        <div key={i} className="flex flex-col gap-4 rounded-lg bg-surface-sunken p-4">
          <div className="flex items-center justify-between gap-3">
            <FormSubhead>{t("repeatLists_addressValue", { value: String(i + 1) })}</FormSubhead>
            {blocks.length > 1 || optional ? (
              <RemoveButton
                label={t("repeatLists_removeAddressValue", { value: String(i + 1) })}
                onClick={() => onChange(blocks.filter((_, k) => k !== i))}
              />
            ) : null}
          </div>
          <AddressFields
            value={b.addr}
            onChange={(addr) => setAt(i, { addr })}
            name={`addresses.${i}.addr`}
            required={!optional}
          />
          <HalfWidth>
            {/* Item 7: a station list is far too long to scan, so it is searched. It
                stays open — our copy of the directory is not the last word on which
                stations exist. */}
            <FormField
              label={t("repeatLists_policeStation")}
              name={`addresses.${i}.police`}
              required={!optional}
              help={t("repeatLists_theStationThisAddressFallsUnder")}
            >
              <ComboField
                value={b.police}
                onChange={(v: string) => setAt(i, { police: v })}
                items={policeStationsFor(court)}
                placeholder={t("repeatLists_searchStations")}
                emptyLabel={t("repeatLists_noStationByThatName")}
                ariaLabel={t("repeatLists_policeStation")}
              />
            </FormField>
          </HalfWidth>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        className="w-fit"
        onClick={() => onChange([...blocks, blankAddressBlock()])}
      >
        <PlusIcon data-icon="inline-start" aria-hidden />
        {translateText(t, addLabel)}
      </Button>
    </div>
  );
}

/**
 * The people summoned for an accused entity.
 *
 * A company cannot be produced before a magistrate, so S-141 reaches the people who were
 * running it: every one of them is a person the summons has to name and find. Hence a
 * list with its own name, contact and address per row, rather than a single "representative".
 */
export function RepresentativeList({
  reps,
  onChange,
  addLabel = "repeatLists_addAnotherPerson",
}: {
  reps: Representative[];
  onChange: (next: Representative[]) => void;
  addLabel?: string;
}) {
  const t = useTranslations();
  const { court } = useCourt();
  const setAt = (i: number, patch: Partial<Representative>) =>
    onChange(reps.map((r, k) => (k === i ? { ...r, ...patch } : r)));

  return (
    <div className="flex flex-col gap-4">
      {reps.map((r, i) => (
        <div key={i} className="flex flex-col gap-4 rounded-lg bg-surface-sunken p-4">
          <div className="flex items-center justify-between gap-3">
            <FormSubhead>{t("repeatLists_personValue", { value: String(i + 1) })}</FormSubhead>
            {reps.length > 1 ? (
              <RemoveButton
                label={t("repeatLists_removePersonValue", { value: String(i + 1) })}
                onClick={() => onChange(reps.filter((_, k) => k !== i))}
              />
            ) : null}
          </div>
          <FormRow>
            <FormField label={t("repeatLists_fullName")} name={`reps.${i}.name`} required>
              <TextField
                value={r.name}
                onChange={(v) => setAt(i, { name: v })}
                placeholder={t("repeatLists_asItShouldAppearOnThe")}
                autoComplete="off"
              />
            </FormField>
            <FormField label={t("repeatLists_designation")} name={`reps.${i}.designation`} required>
              <TextField
                value={r.designation}
                onChange={(v) => setAt(i, { designation: v })}
                placeholder={t("repeatLists_eGManagingDirector")}
                autoComplete="off"
              />
            </FormField>
          </FormRow>
          <FormRow>
            <MobileField
              label={t("repeatLists_mobileNumber")}
              name={`reps.${i}.mobile`}
              optional
              value={r.mobile}
              onChange={(v) => setAt(i, { mobile: v })}
            />
            <FormField label={t("repeatLists_emailAddress")} name={`reps.${i}.email`} optional>
              <TextField
                type="email"
                value={r.email}
                onChange={(v) => setAt(i, { email: v })}
                placeholder="optional@example.com"
                autoComplete="off"
              />
            </FormField>
          </FormRow>
          <FormSubhead>{t("repeatLists_addressForService")}</FormSubhead>
          <AddressFields
            value={r.addr}
            onChange={(addr) => setAt(i, { addr })}
            name={`reps.${i}.addr`}
          />
          <HalfWidth>
            {/* The summons is served at this address, so it is saved with its station like
                the entity's own addresses are. */}
            <FormField
              label={t("repeatLists_policeStation")}
              name={`reps.${i}.police`}
              required
              help={t("repeatLists_theStationThisAddressFallsUnder")}
            >
              <ComboField
                value={r.police ?? ""}
                onChange={(v: string) => setAt(i, { police: v })}
                items={policeStationsFor(court)}
                placeholder={t("repeatLists_searchStations")}
                emptyLabel={t("repeatLists_noStationByThatName")}
                ariaLabel={t("repeatLists_policeStation")}
              />
            </FormField>
          </HalfWidth>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        className="w-fit"
        onClick={() => onChange([...reps, blankRepresentative()])}
      >
        <PlusIcon data-icon="inline-start" aria-hidden />
        {translateText(t, addLabel)}
      </Button>
    </div>
  );
}
