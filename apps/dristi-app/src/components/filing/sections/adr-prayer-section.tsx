"use client";

/**
 * ADR, other details & prayer — willingness to settle, anything else the court should
 * know, and the relief being asked for.
 *
 * Source: demo "ADR, Other details & Prayer" screen. The two prayer editors open on the
 * S-138 templates from `options.ts`; they are a starting draft the filer edits, not
 * fixed text, so both are plain rich text bound straight to the draft.
 */

import * as React from "react";
import { useRouter } from "next/navigation";

import { adrPrayerDetails } from "@/lib/filing/details";
import { neighbours } from "@/lib/filing/steps";
import { useFiling } from "@/lib/filing/store";
import { useDetailsSection } from "@/lib/filing/use-details-section";
import type { AdrPrayer } from "@/lib/filing/types";
import { FilingFooter } from "@/components/filing/filing-footer";
import { FilingPageHeader } from "@/components/filing/filing-page-header";
import { FilingMain } from "@/components/filing/filing-shell";
import { FormCard } from "@/components/filing/form-card";
import { FormField } from "@/components/filing/form-field";
import { SectionNotice } from "@/components/filing/notices";
import { RichTextEditor } from "@/components/filing/rich-text-editor";
import { Segmented, type SegmentedOption } from "@/components/filing/segmented";

const ADR_OPTIONS: SegmentedOption<AdrPrayer["adr"]>[] = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
  { value: "maybe", label: "Maybe" },
];

const ADR_QUESTION =
  "Would you like to settle the case outside the court through alternative methods of dispute resolution if the other party(s) agrees?";

const OTHER_DETAILS_QUESTION =
  "Would you like to add any additional details to the complaint?";

const RELIEF_HELP = "Please edit this where required as per the details of your case.";

export function AdrPrayerSection() {
  const { draft, update, hrefFor } = useFiling();
  const adr = draft.adr;
  const { prev, next } = neighbours("adr-prayer");
  const router = useRouter();
  const { save, saving, error } = useDetailsSection("adr_other_prayer", adrPrayerDetails);

  const set = <K extends keyof AdrPrayer>(key: K, value: AdrPrayer[K]) =>
    update((d) => {
      d.adr[key] = value;
    });

  /* Save the section to the case, then move on. A save failure keeps the filer here with
     the reason, so the data loss is visible. */
  const continueHref = next ? hrefFor(next) : undefined;
  const handleContinue = async () => {
    const result = await save();
    if (result.ok && continueHref) router.push(continueHref);
  };

  return (
    <>
      <FilingMain>
        <FilingPageHeader
          title="ADR, other details & prayer"
          description="Willingness to settle, any additional details for the court, and the relief you are asking for."
        />

        {/* Alternative dispute resolution */}
        <FormCard title="Alternative dispute resolution">
          <FormField asGroup label={ADR_QUESTION}>
            <Segmented
              value={adr.adr}
              onValueChange={(v) => set("adr", v)}
              options={ADR_OPTIONS}
              ariaLabel={ADR_QUESTION}
            />
          </FormField>
        </FormCard>

        {/* Anything else for the court */}
        <FormCard title="Other details">
          <FormField
            asGroup
            label={OTHER_DETAILS_QUESTION}
            tip="Anything the court should know that the form has not already asked for."
            helpPlacement="above"
            help="No need to repeat anything already entered above."
          >
            <RichTextEditor
              value={adr.otherDetails}
              onChange={(html) => set("otherDetails", html)}
              placeholder="Write here"
              ariaLabel={OTHER_DETAILS_QUESTION}
            />
          </FormField>
        </FormCard>

        {/* Prayer */}
        <FormCard
          title="Prayer / relief sought"
          description="The standard S-138 prayer. Edit to fit your case."
        >
          <FormField asGroup label="Interim relief" optional helpPlacement="above" help={RELIEF_HELP}>
            <RichTextEditor
              value={adr.interimRelief}
              onChange={(html) => set("interimRelief", html)}
              ariaLabel="Interim relief"
            />
          </FormField>
          <FormField asGroup label="Final relief" helpPlacement="above" help={RELIEF_HELP}>
            <RichTextEditor
              value={adr.finalRelief}
              onChange={(html) => set("finalRelief", html)}
              ariaLabel="Final relief"
            />
          </FormField>
        </FormCard>

        {error ? (
          <SectionNotice variant="destructive" title="Couldn't save to the court's server">
            {error}
          </SectionNotice>
        ) : null}
      </FilingMain>

      <FilingFooter
        backHref={prev ? hrefFor(prev) : undefined}
        onContinue={continueHref ? handleContinue : undefined}
        continueDisabled={saving}
        continueLabel={saving ? "Saving…" : "Continue"}
      />
    </>
  );
}
