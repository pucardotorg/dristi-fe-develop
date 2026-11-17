"use client";

/**
 * Cheque & return memo — the dishonoured cheque(s) and the bank's memo for each.
 *
 * The uploaded cheque and memo can be opened beside the form. The IFSC is looked up
 * against the public registry — a code that isn't found, or a registry that can't be
 * reached, leaves the bank fields to be typed.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { CreditCardIcon } from "lucide-react";

import { blankCheque } from "@/lib/filing/blank";
import type { IfscResult } from "@/lib/filing/lookups";
import { RETURN_REASONS, S138_SAFE_REASONS } from "@/lib/filing/options";
import {
  chequeComplete,
  chequeNumberIssue,
  chequePresentIssue,
  chequePresentedLate,
  chequeReturnIssue,
  chequeSourceSlot,
} from "@/lib/filing/selectors";
import { neighbours } from "@/lib/filing/steps";
import { useFiling } from "@/lib/filing/store";
import { useChequeEvidence } from "@/lib/filing/use-cheque-evidence";
import { useRemoveCaseRecord } from "@/lib/filing/use-remove-case-record";
import type { ChequeField } from "@/lib/filing/types";
import { ConfirmDialog } from "@/components/filing/confirm-dialog";
import { DateField } from "@/components/filing/date-field";
import { FilingFooter } from "@/components/filing/filing-footer";
import { FilingPageHeader } from "@/components/filing/filing-page-header";
import { FilingMain } from "@/components/filing/filing-shell";
import {
  FormCard,
  FormDivider,
  FormRow,
  FormSubhead,
  HalfWidth,
} from "@/components/filing/form-card";
import { FormField } from "@/components/filing/form-field";
import { CorrectionInstance, useCorrectionInstanceRequest } from "@/components/filing/posture";
import { IfscField } from "@/components/filing/ifsc-field";
import { OptionSelect, PrefixInput, TextField } from "@/components/filing/inputs";
import { InfoWell, SectionNotice } from "@/components/filing/notices";
import { SectionTabs } from "@/components/filing/section-tabs";
import { YesNoSegmented } from "@/components/filing/segmented";
import {
  SourcePanel,
  ViewSourceButton,
  useSourceOpenState,
} from "@/components/filing/source-panel";
import { useTranslations } from "next-intl";

/** Tab ids are cheque ids; `null` when a stale id arrives after a removal. */
function indexOfId(cheques: { id: string }[], id: string): number | null {
  const i = cheques.findIndex((c) => c.id === id);
  return i >= 0 ? i : null;
}

export function ChequeSection() {
  const t = useTranslations();
  const { draft, update, hrefFor } = useFiling();
  const removeRecord = useRemoveCaseRecord();
  const { prev, next } = neighbours("cheque");
  const router = useRouter();
  const { save, saving, error } = useChequeEvidence();
  const cheques = draft.cheques;

  const [active, setActive] = React.useState(0);
  // Kept apart from `removeOpen` so the dialog keeps its wording while it fades out.
  const [removeIndex, setRemoveIndex] = React.useState(0);
  const [removeOpen, setRemoveOpen] = React.useState(false);
  /**
   * The source rail is a column beside the form from `xl` up, so it starts expanded
   * there; below that it is a sheet over the form, opened by "View source document".
   */
  const [sourceOpen, setSourceOpen] = useSourceOpenState();
  /** Which of this cheque's two documents the rail shows. */
  const [sourceDoc, setSourceDoc] = React.useState<"front" | "memo">("front");

  const index = Math.min(active, cheques.length - 1);
  const cheque = cheques[index];

  /* A scrutiny defect on "Cheque 2 › Bank branch" selects that tab before it takes focus. */
  useCorrectionInstanceRequest("cheque", setActive);

  const frontSlot = chequeSourceSlot(draft, index, "cheque-front");
  const memoSlot = chequeSourceSlot(draft, index, "return-memo");
  /* Nothing uploaded for this cheque means there is no source document to show at all. */
  const sourceDocs = [
    {
      key: "front" as const,
      slot: frontSlot,
      fallbackLabel: t("chequeSection_chequeFrontSide"),
    },
    {
      key: "memo" as const,
      slot: memoSlot,
      fallbackLabel: t("chequeSection_chequeReturnMemo"),
    },
  ].filter((d) => d.slot?.file);
  const sourceSlot = sourceDoc === "front" ? frontSlot : memoSlot;

  const editField = (key: ChequeField, value: string) =>
    update((d) => {
      d.cheques[index][key] = value;
    });

  /** Retyping the code invalidates whatever the last lookup filled from it. */
  const editIfsc = (value: string) =>
    update((d) => {
      d.cheques[index].ifsc = value;
      d.cheques[index].ifscFetched = false;
    });

  /** The registry answered — written by cheque id, since tabs can change mid-lookup. */
  const fillFromIfsc = (id: string) => (hit: IfscResult) =>
    update((d) => {
      const c = d.cheques.find((x) => x.id === id);
      if (!c) return;
      c.ifsc = hit.ifsc;
      c.bankName = hit.bank;
      c.bankBranch = hit.branch;
      c.ifscFetched = true;
    });

  const addCheque = () => {
    update((d) => {
      d.cheques.push(blankCheque());
    });
    setActive(cheques.length);
  };

  const askRemove = (id: string) => {
    const i = indexOfId(cheques, id);
    if (i === null || cheques.length <= 1) return;
    setRemoveIndex(i);
    setRemoveOpen(true);
  };

  const confirmRemove = () => {
    const i = removeIndex;
    setRemoveOpen(false);
    // Its upload group goes with it, so the list of documents stops asking for it — and
    // its files leave this browser and the case.
    if (!removeRecord("cheque", i)) return;
    const remaining = cheques.length - 1;
    let a = index;
    if (i < a) a -= 1;
    if (a >= remaining) a = remaining - 1;
    setActive(Math.max(0, a));
  };

  const showBankFields = index === 0 || cheque.sameAsPrev === "no";
  const showInheritNote = index > 0 && cheque.sameAsPrev === "yes";
  const previous = index > 0 ? cheques[index - 1] : null;
  const inheritedBank = previous?.bankName || "previous cheque";
  const presentedLate = chequePresentedLate(cheque);
  const reasonNeedsCheck = !!cheque.returnReason && !S138_SAFE_REASONS.has(cheque.returnReason);

  /* Save every complete cheque and return memo to the case, then move on. A save failure
     keeps the filer here with the reason, so the data loss is visible. */
  const continueHref = next ? hrefFor(next) : undefined;
  const handleContinue = async () => {
    const result = await save();
    if (result.ok && continueHref) router.push(continueHref);
  };

  return (
    <>
      <FilingMain sourceOpen={sourceOpen}>
        <FilingPageHeader
          title={t("chequeSection_chequeReturnMemoTitle")}
          description={t("chequeSection_addTheDishonouredChequeSAnd")}
        />

        <SectionTabs
          tabs={cheques.map((c, i) => ({
            id: c.id,
            label: `Cheque ${i + 1}`,
            meta: c.amount ? `₹${c.amount}` : undefined,
            status: chequeComplete(c) ? "complete" : "attention",
            removable: cheques.length > 1,
          }))}
          activeId={cheque.id}
          onSelect={(id) => setActive(indexOfId(cheques, id) ?? index)}
          onRemove={askRemove}
          addLabel={t("chequeSection_addCheque")}
          onAdd={addCheque}
          trailing={!sourceOpen ? <ViewSourceButton onClick={() => setSourceOpen(true)} /> : null}
        />

        <CorrectionInstance value={index}>
          {/* Cheque leaf */}
          <FormCard
            title={t("chequeSection_chequeValueDetails", { value: String(index + 1) })}
            description={t("chequeSection_asWrittenOnTheChequeLeaf")}
          >
            <FormRow>
              <FormField
                label={t("chequeSection_dateOnCheque")}
                name="dateOnCheque"
                required
                tip={t("chequeSection_asWrittenOnTheCheque")}
              >
                <DateField
                  value={cheque.dateOnCheque}
                  onChange={(v) => editField("dateOnCheque", v)}
                  ariaLabel={t("chequeSection_dateOnCheque")}
                />
              </FormField>
              <FormField
                label={t("chequeSection_amount")}
                name="amount"
                required
                tip={t("chequeSection_asWrittenOnTheCheque")}
              >
                <PrefixInput
                  prefix="₹"
                  value={cheque.amount}
                  onChange={(v) => editField("amount", v)}
                  placeholder={t("chequeSection_enterAmount")}
                  inputMode="numeric"
                />
              </FormField>
            </FormRow>

            <HalfWidth>
              <FormField
                label={t("chequeSection_chequeNumber")}
                name="chequeNumber"
                required
                error={chequeNumberIssue(cheque)}
                tip={t("chequeSection_firstSetOfSixDigitsPrinted")}
                help={t("chequeSection_theSixDigitNumberNotThe")}
              >
                <TextField
                  value={cheque.chequeNumber}
                  onChange={(v) => editField("chequeNumber", v)}
                  placeholder="6-digit number"
                  inputMode="numeric"
                />
              </FormField>
            </HalfWidth>

            {index > 0 ? (
              <>
                <FormDivider />
                <FormField asGroup label={t("chequeSection_areTheBankDetailsBelowThe")}>
                  <YesNoSegmented
                    value={cheque.sameAsPrev}
                    onValueChange={(v) =>
                      update((d) => {
                        d.cheques[index].sameAsPrev = v;
                      })
                    }
                    ariaLabel={t("chequeSection_areTheBankDetailsTheSame")}
                  />
                </FormField>
              </>
            ) : null}

            {showBankFields ? (
              <>
                <FormSubhead>{t("chequeSection_drawersBankDetails")}</FormSubhead>
                {/* Keyed to the cheque so a lookup on one tab never speaks for another. */}
                <IfscField
                  key={cheque.id}
                  value={cheque.ifsc}
                  onChange={editIfsc}
                  onFetched={fillFromIfsc(cheque.id)}
                  fetched={cheque.ifscFetched}
                  tip={t("chequeSection_the11CharacterCodeOnThe")}
                  placeholder={t("chequeSection_eGSbin0001234")}
                />
                <FormRow>
                  <FormField
                    label={t("chequeSection_bankName")}
                    name="bankName"
                    required
                    tip={t("chequeSection_theBankWrittenOnTheCheque")}
                  >
                    <TextField
                      value={cheque.bankName}
                      onChange={(v) => editField("bankName", v)}
                      placeholder={t("chequeSection_drawersBank")}
                    />
                  </FormField>
                  <FormField
                    label={t("chequeSection_bankBranch")}
                    name="bankBranch"
                    required
                    tip={t("chequeSection_theBranchWrittenOnTheCheque")}
                  >
                    <TextField
                      value={cheque.bankBranch}
                      onChange={(v) => editField("bankBranch", v)}
                      placeholder={t("chequeSection_branchName")}
                    />
                  </FormField>
                </FormRow>
              </>
            ) : null}

            {showInheritNote ? (
              <InfoWell>
                <CreditCardIcon className="size-5 shrink-0" aria-hidden />
                <p className="min-w-0 flex-1 text-body">
                  {t.rich("chequeSection_usingBankDetailsFromChequeIndex", {
                    index: String(index),
                    inheritedBank,
                    value: previous?.bankBranch ? `, ${previous.bankBranch}` : "",
                    span: (chunks) => <span className="font-semibold">{chunks}</span>,
                  })}
                </p>
              </InfoWell>
            ) : null}
          </FormCard>

          {/* Return memo */}
          <FormCard
            title={t("chequeSection_chequeReturnMemoDetails")}
            description={t("chequeSection_fromTheMemoTheBankIssued")}
          >
            <FormRow>
              <FormField
                label={t("chequeSection_dateOfPresentationDeposit")}
                name="presentDate"
                required
                tip={t("chequeSection_dateOnWhichTheChequeWas")}
                error={chequePresentIssue(cheque)}
              >
                <DateField
                  value={cheque.presentDate}
                  onChange={(v) => editField("presentDate", v)}
                  ariaLabel={t("chequeSection_dateOfPresentationOrDeposit")}
                />
              </FormField>
              <FormField
                label={t("chequeSection_dateOfReturn")}
                name="returnDate"
                required
                tip={t("chequeSection_dateOnWhichTheChequeWasDishonoured")}
                error={chequeReturnIssue(cheque)}
              >
                <DateField
                  value={cheque.returnDate}
                  onChange={(v) => editField("returnDate", v)}
                  ariaLabel={t("chequeSection_dateOfReturn")}
                />
              </FormField>
            </FormRow>

            {presentedLate ? (
              <SectionNotice variant="warning">{presentedLate}</SectionNotice>
            ) : null}

            <HalfWidth>
              <FormField
                label={t("chequeSection_returnReason")}
                name="returnReason"
                required
                tip={t("chequeSection_reasonForReturnOfTheCheque")}
              >
                <OptionSelect
                  value={cheque.returnReason}
                  onValueChange={(v) => editField("returnReason", v)}
                  options={RETURN_REASONS}
                  placeholder={t("chequeSection_selectReason")}
                  ariaLabel={t("chequeSection_returnReason")}
                />
              </FormField>
            </HalfWidth>

            {reasonNeedsCheck ? (
              <SectionNotice variant="warning" title={t("chequeSection_checkThatS138StillApplies")}>
                {t.rich("chequeSection_section138IsSquarelyAttractedWhen", {
                  span: (chunks) => <span className="font-semibold">{chunks}</span>,
                })}
              </SectionNotice>
            ) : null}
          </FormCard>
        </CorrectionInstance>

        {error ? (
          <SectionNotice
            variant="destructive"
            title={t("chequeSection_couldntSaveToTheCourtsServer")}
          >
            {error}
          </SectionNotice>
        ) : null}
      </FilingMain>

      <FilingFooter
        backHref={prev ? hrefFor(prev) : undefined}
        onContinue={continueHref ? handleContinue : undefined}
        continueDisabled={saving}
        continueLabel={saving ? t("chequeSection_saving") : t("chequeSection_continue")}
      />

      <ConfirmDialog
        open={removeOpen}
        onOpenChange={setRemoveOpen}
        title={t("chequeSection_removeChequeValue", { value: String(removeIndex + 1) })}
        description={t("chequeSection_areYouSureYouWantTo")}
        confirmLabel={t("chequeSection_yesRemove")}
        onConfirm={confirmRemove}
      />

      <SourcePanel
        open={sourceOpen}
        onOpenChange={setSourceOpen}
        title={
          sourceSlot?.label ??
          (sourceDoc === "front"
            ? t("chequeSection_chequeFrontSide")
            : t("chequeSection_chequeReturnMemo"))
        }
        chips={sourceDocs.map((d) => ({
          id: d.key,
          label: d.slot?.file?.name ?? d.slot?.label ?? d.fallbackLabel,
          active: d.key === sourceDoc,
          onClick: () => setSourceDoc(d.key),
        }))}
        file={sourceSlot?.file ?? null}
        uploadHref={hrefFor("upload")}
        imageAlt={sourceDoc === "front" ? "Uploaded cheque" : "Uploaded cheque return memo"}
        note={t("chequeSection_shownFromYourUploadedDocument")}
      />
    </>
  );
}
