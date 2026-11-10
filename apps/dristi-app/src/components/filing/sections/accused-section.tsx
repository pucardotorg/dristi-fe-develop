"use client";
import {useTranslations as __useTranslations} from "@/i18n/use-translations";
import {LocalizedText as __LocalizedText} from "@/components/localized-text";

/**
 * Accused details — who the complaint is against, how the court can reach them, and
 * where process should be served.
 *
 * Source: demo "Accused Details" screen. One tab per accused; Continue is guarded, because
 * an accused with no phone or email makes the summons harder to deliver: the filer is shown
 * what that costs and must confirm it before the filing moves on.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { InfoIcon } from "lucide-react";

import { ChromeDialogContent } from "@/components/chrome/app-chrome";

import { blankAccused } from "@/lib/filing/blank";
import { ACCUSED_ENTITY_TYPES, ACCUSED_TYPES } from "@/lib/filing/options";
import {
  accusedComplete,
  accusedHasContact,
  accusedLabel,
} from "@/lib/filing/selectors";
import { nameList } from "@/lib/filing/format";
import { neighbours } from "@/lib/filing/steps";
import { useFiling } from "@/lib/filing/store";
import type { Accused, AccusedType } from "@/lib/filing/types";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/filing/confirm-dialog";
import { FilingFooter } from "@/components/filing/filing-footer";
import { FilingPageHeader } from "@/components/filing/filing-page-header";
import { FilingMain } from "@/components/filing/filing-shell";
import { FormCard, FormRow, HalfWidth } from "@/components/filing/form-card";
import { FormField } from "@/components/filing/form-field";
import { CorrectionInstance } from "@/components/filing/posture";
import { OptionSelect, TextField } from "@/components/filing/inputs";
import { SectionNotice } from "@/components/filing/notices";
import {
  AddressBlockList,
  ContactList,
  RepresentativeList,
} from "@/components/filing/repeat-lists";
import { SectionTabs } from "@/components/filing/section-tabs";
import { YesNoSegmented } from "@/components/filing/segmented";

export function AccusedSection() {
  const __t = __useTranslations();
  const { draft, update, hrefFor } = useFiling();
  const router = useRouter();
  const { prev, next } = neighbours("accused");

  // Tracked by id, so removing an accused cannot leave the tabs pointing at a stale index.
  const [activeId, setActiveId] = React.useState(() => draft.accused[0]?.id ?? "");
  const [noContactOpen, setNoContactOpen] = React.useState(false);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [confirmChecked, setConfirmChecked] = React.useState(false);
  const [pendingRemove, setPendingRemove] = React.useState<string | null>(null);
  // Held apart from `pendingRemove` so the title stays put while the dialog animates out.
  const [pendingRemoveLabel, setPendingRemoveLabel] = React.useState("");

  const found = draft.accused.findIndex((x) => x.id === activeId);
  const index = found >= 0 ? found : draft.accused.length - 1;
  const a = draft.accused[index];
  const isIndividual = a.type === "individual";

  const confirmCheckboxId = React.useId();
  const confirmStatementId = React.useId();

  const setField = <K extends keyof Accused>(key: K, value: Accused[K]) =>
    update((d) => {
      d.accused[index][key] = value;
    });

  const addAccused = () => {
    const created = blankAccused();
    update((d) => {
      d.accused.push(created);
    });
    setActiveId(created.id);
  };

  const askRemove = (id: string) => {
    const i = draft.accused.findIndex((x) => x.id === id);
    if (i < 0 || draft.accused.length <= 1) return;
    setPendingRemoveLabel(accusedLabel(draft.accused[i], i));
    setPendingRemove(id);
  };

  const removeAccused = (id: string) => {
    if (draft.accused.length <= 1) return;
    const i = draft.accused.findIndex((x) => x.id === id);
    if (i < 0) return;
    const fallback = draft.accused[i + 1] ?? draft.accused[i - 1];
    update((d) => {
      d.accused.splice(i, 1);
    });
    if (id === activeId && fallback) setActiveId(fallback.id);
  };

  const goToNext = () => {
    setNoContactOpen(false);
    setConfirmOpen(false);
    router.push(hrefFor(next ?? "cheque"));
  };

  /**
   * Every accused is checked, not just the one on screen: with two tabs open the guard
   * would otherwise wave through whichever one is not being looked at.
   */
  const missingContact = draft.accused.filter((acc) => !accusedHasContact(acc));
  const missingNames = nameList(
    draft.accused.flatMap((acc, i) =>
      accusedHasContact(acc) ? [] : [accusedLabel(acc, i)]
    )
  );

  const handleContinue = () => {
    if (missingContact.length === 0) {
      goToNext();
      return;
    }
    setConfirmChecked(false);
    setNoContactOpen(true);
  };

  /** Send the person to the first accused that is actually missing a contact. */
  const goToMissing = () => {
    setNoContactOpen(false);
    setConfirmOpen(false);
    if (missingContact[0]) setActiveId(missingContact[0].id);
  };

  const proceedWithoutDetails = () => {
    setNoContactOpen(false);
    setConfirmChecked(false);
    setConfirmOpen(true);
  };

  return (
    <>
      <FilingMain>
        <FilingPageHeader
          title={__t("accusedSection_accusedDetails")}
          description={__t("accusedSection_addThePersonOrEntityThisComplaint")}
        />

        <SectionTabs
          tabs={draft.accused.map((acc, i) => ({
            id: acc.id,
            label: __t("accusedSection_accusedValue0", {value0: String(i + 1)}),
            meta: acc.name || undefined,
            status: accusedComplete(acc) ? "complete" : "attention",
            removable: draft.accused.length > 1,
          }))}
          activeId={a.id}
          onSelect={setActiveId}
          onRemove={askRemove}
          addLabel="Add accused"
          onAdd={addAccused}
        />

        {/* Which accused the fields below belong to, so a check can point at its field. */}
        <CorrectionInstance value={index}>
        {/*
          Identity. "Is the accused a person or an institution?" and "what kind of
          institution?" are two questions: the old single list made you answer the second
          to get past the first, and left "Proprietorship" sitting next to "Individual" as
          though they were the same kind of answer.

          Age is gone. It was optional, nothing downstream read it, and nobody knows the
          age of the person they are suing (owner, 2026-08-19).
        */}
        <FormCard title={isIndividual ? __t("accusedSection_accusedValue0Details", {value0: String(index + 1)}) : __t("accusedSection_entityDetails")}>
          <FormRow>
            <FormField label={__t("accusedSection_accusedType")} required>
              <OptionSelect
                value={a.type}
                onValueChange={(v) => setField("type", v as AccusedType)}
                options={ACCUSED_TYPES}
              />
            </FormField>
            {isIndividual ? null : (
              <FormField label={__t("accusedSection_typeOfEntity")} name="entType" required>
                <OptionSelect
                  value={a.entType}
                  onValueChange={(v) => setField("entType", v)}
                  options={ACCUSED_ENTITY_TYPES}
                  placeholder={__t("accusedSection_selectType")}
                />
              </FormField>
            )}
          </FormRow>
          <HalfWidth>
            <FormField label={isIndividual ? __t("accusedSection_fullName") : __t("accusedSection_entityName")} name="name" required>
              <TextField
                value={a.name}
                onChange={(v) => setField("name", v)}
                placeholder={__t("accusedSection_asItShouldAppearOnTheSummons")}
                autoComplete="off"
              />
            </FormField>
          </HalfWidth>
        </FormCard>

        {/*
          Who answers for the entity. Under S-141 the company is not summoned alone —
          every person who was in charge of its business when the cheque bounced is
          proceeded against with it, so this is a list, not a field.
        */}
        {isIndividual ? null : (
          <FormCard
            title={__t("accusedSection_whoIsSummonedForTheEntity")}
            description={__t("accusedSection_directorsPartnersOrOfficersInChargeOf")}
          >
            <RepresentativeList
              reps={a.reps}
              onChange={(reps) => setField("reps", reps)}
            />
          </FormCard>
        )}

        {/* Contact */}
        <FormCard
          title={__t("accusedSection_contactDetails")}
          description={__t("accusedSection_whereTheCourtCanReachTheAccused")}
        >
          <ContactList
            contacts={a.contacts}
            onChange={(contacts) => setField("contacts", contacts)}
          />
        </FormCard>

        {/* Service addresses */}
        <FormCard title={__t("accusedSection_addressDetails")}>
          {!draft.dismissed.accusedAddress ? (
            <SectionNotice
              variant="info"
              onDismiss={() =>
                update((d) => {
                  d.dismissed.accusedAddress = true;
                })
              }
            >
              {<__LocalizedText id="accusedSection_theSummonsGoesToEveryAddressListed" />}{" "}</SectionNotice>
          ) : null}
          <AddressBlockList
            blocks={a.addresses}
            onChange={(addresses) => setField("addresses", addresses)}
          />
        </FormCard>

        {/* Jurisdiction */}
        <FormCard title={__t("accusedSection_jurisdiction")}>
          <FormField
            asGroup
            label={__t("accusedSection_doesTheAccusedResideWithinTheJurisdiction")}
            help="The court decides jurisdiction on the facts."
          >
            <YesNoSegmented
              value={a.jurisdiction}
              onValueChange={(v) => setField("jurisdiction", v)}
              ariaLabel="Does the accused reside within the jurisdiction of this court?"
            />
          </FormField>
        </FormCard>
        </CorrectionInstance>
      </FilingMain>

      <FilingFooter
        backHref={prev ? hrefFor(prev) : undefined}
        onContinue={handleContinue}
      />

      {/* Continue while some accused — named here — has no phone or email. */}
      <Dialog open={noContactOpen} onOpenChange={setNoContactOpen}>
        <ChromeDialogContent mobileSheet className="sm:max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <span
                aria-hidden
                className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-info-muted text-info-muted-foreground"
              >
                <InfoIcon className="size-5" />
              </span>
              <DialogTitle>{<__LocalizedText id="accusedSection_noContactDetailsAdded" />}</DialogTitle>
            </div>
            <DialogDescription>
              {<__LocalizedText id="accusedSection_noPhoneNumberOrEmailHasBeen" />}{" "}{missingNames}{<__LocalizedText id="accusedSection_addingOneIncreasesTheChancesOfThe" />}{" "}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={proceedWithoutDetails}>
              {<__LocalizedText id="accusedSection_proceedWithoutDetails" />}{" "}</Button>
            <Button type="button" onClick={goToMissing}>
              {<__LocalizedText id="accusedSection_addDetails" />}{" "}</Button>
          </DialogFooter>
        </ChromeDialogContent>
      </Dialog>

      {/* The confirmation itself — the court is told this was a considered choice. */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <ChromeDialogContent mobileSheet aria-describedby={confirmStatementId} className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{<__LocalizedText id="accusedSection_confirmProceedWithoutDetails" />}</DialogTitle>
          </DialogHeader>
          <Label
            htmlFor={confirmCheckboxId}
            id={confirmStatementId}
            className="items-start gap-3 font-normal text-foreground"
          >
            <Checkbox
              id={confirmCheckboxId}
              checked={confirmChecked}
              onCheckedChange={(checked) => setConfirmChecked(checked === true)}
              className="mt-0.5"
            />
            {/* Wraps to several lines — the Label's own leading-none would collide. */}
            <span className="leading-normal">
              {<__LocalizedText id="accusedSection_iConfirmThatIHaveNoKnowledge" />}{" "}
              {missingNames}{<__LocalizedText id="accusedSection_andCannotLocateThemWithReasonableEffort" />}{" "}</span>
          </Label>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={goToMissing}>
              {<__LocalizedText id="accusedSection_addDetails" />}{" "}</Button>
            <Button
              type="button"
              onClick={goToNext}
              disabled={!confirmChecked}
              aria-disabled={!confirmChecked || undefined}
            >
              {<__LocalizedText id="accusedSection_confirm" />}{" "}</Button>
          </DialogFooter>
        </ChromeDialogContent>
      </Dialog>

      <ConfirmDialog
        open={pendingRemove !== null}
        onOpenChange={(open) => {
          if (!open) setPendingRemove(null);
        }}
        title={__t("accusedSection_removeValue0", {value0: String(__t(pendingRemoveLabel) || __t("accusedSection_accused"))})}
        description={__t("accusedSection_areYouSureYouWantToDelete")}
        confirmLabel={__t("accusedSection_yesRemove")}
        onConfirm={() => {
          if (pendingRemove) removeAccused(pendingRemove);
          setPendingRemove(null);
        }}
      />
    </>
  );
}
