"use client";

/**
 * ADR, other details & prayer — willingness to settle, anything else the court should
 * know, and the relief being asked for.
 *
 * Source: demo "ADR, Other details & Prayer" screen. The two prayer editors open on the
 * S-138 templates from `options.ts`; they are a starting draft the filer edits, not
 * fixed text, so both are plain rich text bound straight to the draft.
 *
 * Other details can be generated from a format with the form's details filled in, then
 * edited as plain text — see `other-details-field.tsx`.
 */

import * as React from "react";

import { adrPrayerDetails } from "@/lib/filing/details";
import { neighbours } from "@/lib/filing/steps";
import { useFiling } from "@/lib/filing/store";
import { useContinue } from "@/lib/filing/use-continue";
import { useDetailsSection } from "@/lib/filing/use-details-section";
import type { AdrPrayer } from "@/lib/filing/types";
import { FilingFooter } from "@/components/filing/filing-footer";
import { FilingPageHeader } from "@/components/filing/filing-page-header";
import { FilingMain } from "@/components/filing/filing-shell";
import { FormCard } from "@/components/filing/form-card";
import { FormField } from "@/components/filing/form-field";
import { OtherDetailsField } from "@/components/filing/other-details-field";
import { RichTextEditor } from "@/components/filing/rich-text-editor";
import { Segmented, type SegmentedOption } from "@/components/filing/segmented";
import { useTranslations } from "next-intl";

const ADR_OPTIONS: SegmentedOption<AdrPrayer["adr"]>[] = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
  { value: "maybe", label: "Maybe" },
];

const ADR_QUESTION = "adrPrayerSection_isTheComplainantWillingToSettle";

const OTHER_DETAILS_QUESTION = "adrPrayerSection_wouldYouLikeToAddAny";

const RELIEF_HELP = "adrPrayerSection_pleaseEditThisWhereRequiredAs";

export function AdrPrayerSection() {
  const t = useTranslations();
  const { draft, update, hrefFor } = useFiling();
  const adr = draft.adr;
  const { prev, next } = neighbours("adr-prayer");
  const { save, autosaveProps } = useDetailsSection("adr_other_prayer", adrPrayerDetails);

  const set = <K extends keyof AdrPrayer>(key: K, value: AdrPrayer[K]) =>
    update((d) => {
      d.adr[key] = value;
    });

  /* Save the section to the case, then move on. A save failure keeps the filer here with
     the reason, so the data loss is visible. */
  const continueHref = next ? hrefFor(next) : undefined;
  const { continuing, onContinue } = useContinue(save, continueHref);

  return (
    <>
      <FilingMain {...autosaveProps}>
        <FilingPageHeader
          title={t("adrPrayerSection_adrOtherDetailsPrayer")}
          description={t("adrPrayerSection_willingnessToSettleAnyAdditionalDetails")}
        />

        {/* Alternative dispute resolution */}
        <FormCard title={t("adrPrayerSection_alternativeDisputeResolution")}>
          <FormField asGroup label={t(ADR_QUESTION)}>
            <Segmented
              value={adr.adr}
              onValueChange={(v) => set("adr", v)}
              options={ADR_OPTIONS}
              ariaLabel={t(ADR_QUESTION)}
            />
          </FormField>
        </FormCard>

        {/* Anything else for the court */}
        <FormCard title={t("adrPrayerSection_otherDetails")}>
          <FormField
            asGroup
            label={t(OTHER_DETAILS_QUESTION)}
            tip={t("adrPrayerSection_anythingTheCourtShouldKnowThat")}
            helpPlacement="above"
            help={t("adrPrayerSection_noNeedToRepeatAnythingAlready")}
          >
            <OtherDetailsField
              value={adr.otherDetails}
              formatId={adr.detailsFormat}
              onChange={(html) => set("otherDetails", html)}
              onGenerate={(formatId, html) =>
                update((d) => {
                  d.adr.detailsFormat = formatId;
                  d.adr.otherDetails = html;
                })
              }
              ariaLabel={t(OTHER_DETAILS_QUESTION)}
            />
          </FormField>
        </FormCard>

        {/* Prayer */}
        <FormCard
          title={t("adrPrayerSection_prayerReliefSought")}
          description={t("adrPrayerSection_theStandardS138PrayerEdit")}
        >
          <FormField
            asGroup
            label={t("adrPrayerSection_interimRelief")}
            required
            helpPlacement="above"
            help={t(RELIEF_HELP)}
          >
            <RichTextEditor
              value={adr.interimRelief}
              onChange={(html) => set("interimRelief", html)}
              ariaLabel={t("adrPrayerSection_interimRelief")}
            />
          </FormField>
          <FormField
            asGroup
            label={t("adrPrayerSection_finalRelief")}
            required
            helpPlacement="above"
            help={t(RELIEF_HELP)}
          >
            <RichTextEditor
              value={adr.finalRelief}
              onChange={(html) => set("finalRelief", html)}
              ariaLabel={t("adrPrayerSection_finalRelief")}
            />
          </FormField>
        </FormCard>
      </FilingMain>

      <FilingFooter
        backHref={prev ? hrefFor(prev) : undefined}
        onContinue={continueHref ? onContinue : undefined}
        continueDisabled={continuing}
        continueLabel={continuing ? t("adrPrayerSection_saving") : t("adrPrayerSection_continue")}
      />
    </>
  );
}
