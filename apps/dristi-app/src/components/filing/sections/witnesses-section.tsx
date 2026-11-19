"use client";

/**
 * Witnesses — who the complainant intends to rely on, and how the court reaches them.
 *
 * Source: demo "Witnesses" screen. A witness can be identified by name *or* by official
 * designation ("Bank Manager, SBI Sector 17"), so the two are offered as alternatives
 * either side of an OR rule rather than as two required fields.
 */

import * as React from "react";

import { blankWitness } from "@/lib/filing/blank";
import { firstWitnessClash, mobileConflicts } from "@/lib/filing/mobile-conflicts";
import { witnessComplete, witnessEntered } from "@/lib/filing/selectors";
import { neighbours } from "@/lib/filing/steps";
import { useFiling } from "@/lib/filing/store";
import { removePartyFromCase, useCaseParties } from "@/lib/filing/use-case-parties";
import type { Witness } from "@/lib/filing/types";
import { FieldSeparator } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/filing/confirm-dialog";
import { FilingFooter } from "@/components/filing/filing-footer";
import { FilingPageHeader } from "@/components/filing/filing-page-header";
import { FilingMain } from "@/components/filing/filing-shell";
import { FormCard, HalfWidth } from "@/components/filing/form-card";
import { FormField } from "@/components/filing/form-field";
import { useMobileConflictMessage } from "@/components/filing/mobile-field";
import { CorrectionInstance } from "@/components/filing/posture";
import { TextField } from "@/components/filing/inputs";
import { SectionNotice, UnsavedNotice } from "@/components/filing/notices";
import { AddressBlockList, ContactList } from "@/components/filing/repeat-lists";
import { SectionTabs } from "@/components/filing/section-tabs";
import { useTranslations } from "next-intl";

export function WitnessesSection() {
  const t = useTranslations();
  const { draft, update, hrefFor } = useFiling();
  const { prev, next } = neighbours("witnesses");
  const { unsaved, retryUnsaved } = useCaseParties("witness");

  const [activeId, setActiveId] = React.useState(() => draft.witnesses[0]?.id ?? "");
  const [removeId, setRemoveId] = React.useState<string | null>(null);
  // Held separately from `removeId` so the title stays put while the dialog animates out.
  const [removeNumber, setRemoveNumber] = React.useState(1);

  const found = draft.witnesses.findIndex((x) => x.id === activeId);
  const index = found >= 0 ? found : draft.witnesses.length - 1;
  const w = draft.witnesses[index];

  const conflicts = mobileConflicts(draft);
  const clashAt = firstWitnessClash(conflicts);
  const conflictMessage = useMobileConflictMessage();
  /** A number a complainant or accused already has stops the step; the filer is taken to it. */
  const showClash = () => {
    if (clashAt !== undefined) setActiveId(draft.witnesses[clashAt].id);
  };

  const setField = <K extends keyof Witness>(key: K, value: Witness[K]) =>
    update((d) => {
      d.witnesses[index][key] = value;
    });

  const addWitness = () => {
    const created = blankWitness();
    update((d) => {
      d.witnesses.push(created);
    });
    setActiveId(created.id);
  };

  const askRemove = (id: string) => {
    const i = draft.witnesses.findIndex((x) => x.id === id);
    if (i < 0) return;
    setRemoveNumber(i + 1);
    setRemoveId(id);
  };

  // Removing the only witness leaves a blank row in its place: a witness with nothing
  // entered is no witness, so the page always has a form and the case has none.
  const confirmRemove = () => {
    const i = removeId ? draft.witnesses.findIndex((x) => x.id === removeId) : -1;
    if (i < 0) {
      setRemoveId(null);
      return;
    }
    const replacement = draft.witnesses.length === 1 ? blankWitness() : undefined;
    const fallback = replacement ?? draft.witnesses[i + 1] ?? draft.witnesses[i - 1];
    removePartyFromCase(draft.witnesses[i]);
    update((d) => {
      if (replacement) d.witnesses.splice(i, 1, replacement);
      else d.witnesses.splice(i, 1);
    });
    if (removeId === activeId && fallback) setActiveId(fallback.id);
    setRemoveId(null);
  };

  return (
    <>
      <FilingMain>
        <FilingPageHeader
          title={t("witnessesSection_witnesses")}
          description={t("witnessesSection_listTheWitnessesTheComplainantIntends")}
        />

        {unsaved.length > 0 ? (
          <UnsavedNotice
            labels={unsaved.map(
              (x) => x.fullName.trim() || `Witness ${draft.witnesses.indexOf(x) + 1}`,
            )}
            error={unsaved[0].syncError ?? ""}
            noun="details"
            onRetry={() => void retryUnsaved()}
          />
        ) : null}

        <SectionTabs
          tabs={draft.witnesses.map((wit, i) => ({
            id: wit.id,
            label: `Witness ${i + 1}`,
            status: witnessComplete(wit) ? "complete" : "attention",
            // A lone blank row is already "no witness"; there is nothing to remove.
            removable: draft.witnesses.length > 1 || witnessEntered(wit),
          }))}
          activeId={w.id}
          onSelect={setActiveId}
          onRemove={askRemove}
          addLabel={t("witnessesSection_addWitness")}
          onAdd={addWitness}
        />

        {/* Which witness the fields below belong to, so a check can point at its field. */}
        <CorrectionInstance value={index}>
          {/* Identity */}
          <FormCard
            title={t("witnessesSection_witnessValue", { value: String(index + 1) })}
            description={t("witnessesSection_enoughForTheCourtToIdentify")}
          >
            {/*
            Name and designation are one question with two ways of answering it, so the
            requirement sits on the group and neither field is marked required on its own
            — a `*` on both said "fill in both", which is the opposite of what the OR
            means. Age is a separate question and lives outside the group, where the rule
            between the two alternatives cannot be read as reaching it.
          */}
            <FormField
              asGroup
              label={t("witnessesSection_howIsThisWitnessIdentified")}
              required
              help={t("witnessesSection_eitherOneIsEnoughUseThe")}
              helpPlacement="above"
            >
              <div className="flex flex-col gap-4">
                <FormField label={t("witnessesSection_fullName")} name="fullName">
                  <TextField
                    value={w.fullName}
                    onChange={(v) => setField("fullName", v)}
                    placeholder={t("witnessesSection_eGRameshNair")}
                    autoComplete="off"
                  />
                </FormField>

                <FieldSeparator>{t("witnessesSection_or")}</FieldSeparator>

                <FormField label={t("witnessesSection_designation")} name="designation">
                  <TextField
                    value={w.designation}
                    onChange={(v) => setField("designation", v)}
                    placeholder={t("witnessesSection_eGBankManagerSbiSector")}
                    autoComplete="off"
                  />
                </FormField>
              </div>
            </FormField>

            <HalfWidth>
              <FormField label={t("witnessesSection_age")} optional>
                <TextField
                  value={w.age}
                  onChange={(v) => setField("age", v)}
                  placeholder={t("witnessesSection_eG42")}
                  inputMode="numeric"
                />
              </FormField>
            </HalfWidth>

            <FormField label={t("witnessesSection_whatWillThisWitnessProve")} optional>
              <Textarea
                value={w.prove}
                onChange={(e) => setField("prove", e.target.value)}
                placeholder={t("witnessesSection_eGConfirmsTheChequeWas")}
              />
            </FormField>
          </FormCard>

          {/* Contact */}
          <FormCard
            title={t("witnessesSection_witnessValueContactDetails", { value: String(index + 1) })}
            description={t("witnessesSection_whereTheCourtCanReachThis")}
          >
            <ContactList
              contacts={w.contacts}
              onChange={(contacts) => setField("contacts", contacts)}
              addLabel={t("witnessesSection_addMore")}
              emailLabel={t("witnessesSection_emailId")}
              mobilePlaceholder={t("witnessesSection_enterMobileNumber")}
              emailPlaceholder={t("witnessesSection_exXyzGmailCom")}
              mobileConflicts={conflicts.witness[index]?.map((other) => conflictMessage(other))}
            />
          </FormCard>

          {/* Service addresses */}
          <FormCard
            title={t("witnessesSection_witnessValueAddressDetails", { value: String(index + 1) })}
          >
            <SectionNotice variant="info">
              {t("witnessesSection_theCourtTriesEveryAddressListed")}
            </SectionNotice>
            <AddressBlockList
              blocks={w.addresses}
              onChange={(addresses) => setField("addresses", addresses)}
              addLabel={t("witnessesSection_addAddress")}
            />
          </FormCard>
        </CorrectionInstance>
      </FilingMain>

      <FilingFooter
        backHref={prev ? hrefFor(prev) : undefined}
        continueHref={next ? hrefFor(next) : undefined}
        onContinue={showClash}
        continueBlocked={clashAt !== undefined}
        continueHint={t("mobileConflict_continueHint")}
      />

      <ConfirmDialog
        note={t("witnessesSection_thisCannotBeUndone")}
        open={removeId !== null}
        onOpenChange={(open) => {
          if (!open) setRemoveId(null);
        }}
        title={t("witnessesSection_removeWitnessRemoveNumber", {
          removeNumber: String(removeNumber),
        })}
        description={t("witnessesSection_areYouSureYouWantTo")}
        confirmLabel={t("witnessesSection_yesRemove")}
        onConfirm={confirmRemove}
      />
    </>
  );
}
