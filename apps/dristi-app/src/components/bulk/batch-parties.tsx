"use client";

import * as React from "react";
import Link from "next/link";
import { ExternalLinkIcon } from "lucide-react";

import {
  readDetailsFormats,
  serverDetailsFormats,
  subscribeToDetailsFormats,
} from "@/lib/filing/details-formats";
import type { AdrPrayer } from "@/lib/filing/types";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useTranslations } from "next-intl";
import { translateText } from "@/i18n/translate-text";

export type Adr = AdrPrayer["adr"];

/** The filing's own ADR answers (`adr-prayer-section`), in the same order. */
const ADR_CHOICES: { value: Adr; label: string }[] = [
  { value: "yes", label: "batchParties_yes" },
  { value: "no", label: "batchParties_no" },
  { value: "maybe", label: "batchParties_maybe" },
];

/**
 * What is the same for every case in a bulk upload besides its complainants and advocates
 * (set on the upload's own Complainant and Advocate sections): ADR, and the format each
 * case's additional details are generated from.
 */
export function BatchParties({
  adr,
  setAdr,
  formatId,
  setFormatId,
}: {
  adr: Adr;
  setAdr: (v: Adr) => void;
  /** "" for none. */
  formatId: string;
  setFormatId: (id: string) => void;
}) {
  const t = useTranslations();
  const formats = React.useSyncExternalStore(
    subscribeToDetailsFormats,
    readDetailsFormats,
    serverDetailsFormats,
  );
  return (
    <>
      <Field className="gap-1.5">
        <FieldLabel>{t("batchParties_willingToSettleThroughAdr")}</FieldLabel>
        <RadioGroup
          value={adr}
          onValueChange={(v) => setAdr(v as Adr)}
          className="flex gap-6"
        >
          {ADR_CHOICES.map(({ value: v, label }) => (
            <label
              key={v}
              htmlFor={`adr-${v}`}
              className="flex min-h-10 cursor-pointer items-center gap-2 text-body-compact"
            >
              <RadioGroupItem
                value={v}
                id={`adr-${v}`}
                aria-label={translateText(t, label)}
              />
              {translateText(t, label)}
            </label>
          ))}
        </RadioGroup>
      </Field>
      <Field className="gap-1.5">
        <FieldLabel htmlFor="details-format">{t("batchParties_additionalDetails")}</FieldLabel>
        <NativeSelect
          id="details-format"
          value={formatId}
          onChange={(e) => setFormatId(e.target.value)}
        >
          <NativeSelectOption value="">{t("batchParties_onlyWhatTheSheetHas")}</NativeSelectOption>
          {formats.map((f) => (
            <NativeSelectOption key={f.id} value={f.id}>
              Generate from: {f.name || "Untitled"}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <FieldDescription>
          {t("batchParties_eachCaseGetsTheFormatsText")}
          <Link
            href="/filings/formats"
            target="_blank"
            rel="noopener"
            className="inline-flex items-center gap-1 text-foreground underline underline-offset-3"
          >
            {t("batchParties_editFormats")}
            <ExternalLinkIcon aria-hidden className="size-3" />
            <span className="sr-only">{t("batchParties_opensInANewTab")}</span>
          </Link>
        </FieldDescription>
      </Field>
    </>
  );
}
