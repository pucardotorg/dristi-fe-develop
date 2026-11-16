"use client";

/**
 * Demand notice & debt — the statutory notice and the debt the cheque was meant to clear.
 *
 * The uploaded notice, postal receipt and AD card can be opened beside the form. Service
 * branches on whether the notice was delivered.
 */

import * as React from "react";
import { useRouter } from "next/navigation";

import { blankNotice } from "@/lib/filing/blank";
import {
  MODE_OF_SERVICE,
  NATURE_OF_DEBT,
  NON_DELIVERY_REASONS,
  PAYMENT_STATUS,
} from "@/lib/filing/options";
import {
  noticeSourceSlot,
  noticeComplete,
  noticeDispatchIssue,
  noticeDispatchLate,
  noticeServiceIssue,
} from "@/lib/filing/selectors";
import { neighbours } from "@/lib/filing/steps";
import { useFiling } from "@/lib/filing/store";
import { useDemandNoticeEvidence } from "@/lib/filing/use-demand-notice-evidence";
import { useRemoveCaseRecord } from "@/lib/filing/use-remove-case-record";
import type { DemandNotice, NoticeField } from "@/lib/filing/types";
import { ConfirmDialog } from "@/components/filing/confirm-dialog";
import { DateField } from "@/components/filing/date-field";
import { FilingFooter } from "@/components/filing/filing-footer";
import { FilingPageHeader } from "@/components/filing/filing-page-header";
import { FilingMain } from "@/components/filing/filing-shell";
import {
  FormCard,
  FormDivider,
  FormRow,
  HalfWidth,
} from "@/components/filing/form-card";
import { FormField } from "@/components/filing/form-field";
import {
  CorrectionInstance,
  useCorrectionInstanceRequest,
} from "@/components/filing/posture";
import {
  OptionSelect,
  PrefixInput,
  TextField,
} from "@/components/filing/inputs";
import { SectionNotice } from "@/components/filing/notices";
import { SectionTabs } from "@/components/filing/section-tabs";
import { YesNoSegmented } from "@/components/filing/segmented";
import {
  SourcePanel,
  ViewSourceButton,
  useSourceOpenState,
} from "@/components/filing/source-panel";
import { useTranslations } from "next-intl";

/** Chip wording when a notice was added beyond the documents intake asked for. */
const DOC_LABELS = {
  "demand-notice": "Demand notice",
  "dispatch-proof": "Proof of dispatch",
  "delivery-proof": "Proof of delivery",
} as const;

/** Tab ids are notice ids; `null` when a stale id arrives after a removal. */
function indexOfId(notices: { id: string }[], id: string): number | null {
  const i = notices.findIndex((n) => n.id === id);
  return i >= 0 ? i : null;
}

export function DemandNoticeSection() {
  const t = useTranslations();
  const { draft, update, hrefFor } = useFiling();
  const removeRecord = useRemoveCaseRecord();
  const { prev, next } = neighbours("demand-notice");
  const router = useRouter();
  const { save, saving, error } = useDemandNoticeEvidence();
  const notices = draft.notices;

  const [active, setActive] = React.useState(0);
  // Kept apart from `removeOpen` so the dialog keeps its wording while it fades out.
  const [removeIndex, setRemoveIndex] = React.useState(0);
  const [removeOpen, setRemoveOpen] = React.useState(false);
  /**
   * The source rail is a column beside the form from `xl` up, so it starts expanded
   * there; below that it is a sheet over the form, opened by "View source document".
   */
  const [sourceOpen, setSourceOpen] = useSourceOpenState();
  /** Which of this notice's uploads the rail shows. */
  const [sourceDoc, setSourceDoc] =
    React.useState<keyof typeof DOC_LABELS>("demand-notice");

  const index = Math.min(active, notices.length - 1);
  const notice = notices[index];

  /* A scrutiny defect on "Demand notice 1 › Tracking number" selects that tab first. */
  useCorrectionInstanceRequest("demand-notice", setActive);

  // The three uploads behind this notice; any of them may not be uploaded yet.
  const slots = {
    "demand-notice": noticeSourceSlot(draft, index, "demand-notice"),
    "dispatch-proof": noticeSourceSlot(draft, index, "dispatch-proof"),
    "delivery-proof": noticeSourceSlot(draft, index, "delivery-proof"),
  };

  const set = <K extends keyof DemandNotice>(key: K, value: DemandNotice[K]) =>
    update((d) => {
      d.notices[index][key] = value;
    });

  const editField = (key: NoticeField, value: string) =>
    update((d) => {
      d.notices[index][key] = value;
    });

  const sourceSlot = slots[sourceDoc];
  /* Only uploaded documents are offered; with none there is no source rail at all. */
  const uploadedDocs = (Object.keys(slots) as (keyof typeof slots)[]).filter(
    (doc) => slots[doc]?.file,
  );

  const addNotice = () => {
    update((d) => {
      d.notices.push(blankNotice());
    });
    setActive(notices.length);
  };

  const askRemove = (id: string) => {
    const i = indexOfId(notices, id);
    if (i === null || notices.length <= 1) return;
    setRemoveIndex(i);
    setRemoveOpen(true);
  };

  const confirmRemove = () => {
    const i = removeIndex;
    setRemoveOpen(false);
    // Its upload group goes with it, so the list of documents stops asking for it — and
    // its files leave this browser and the case.
    if (!removeRecord("notice", i)) return;
    const remaining = notices.length - 1;
    let a = index;
    if (i < a) a -= 1;
    if (a >= remaining) a = remaining - 1;
    setActive(Math.max(0, a));
  };

  /* Save every complete demand notice to the case, then move on. A save failure keeps the
     filer here with the reason, so the data loss is visible. */
  const continueHref = next ? hrefFor(next) : undefined;
  const handleContinue = async () => {
    const result = await save();
    if (result.ok && continueHref) router.push(continueHref);
  };

  return (
    <>
      <FilingMain sourceOpen={sourceOpen}>
        <FilingPageHeader
          title={t("demandNoticeSection_demandNoticeDebt")}
          description={t("demandNoticeSection_detailsOfTheStatutoryDemandNotice")}
        />

        <SectionTabs
          tabs={notices.map((n, i) => ({
            id: n.id,
            label: `Demand notice ${i + 1}`,
            status: noticeComplete(n) ? "complete" : "attention",
            removable: notices.length > 1,
          }))}
          activeId={notice.id}
          onSelect={(id) => setActive(indexOfId(notices, id) ?? index)}
          onRemove={askRemove}
          addLabel={t("demandNoticeSection_addDemandNotice")}
          onAdd={addNotice}
          trailing={
            !sourceOpen ? (
              <ViewSourceButton onClick={() => setSourceOpen(true)} />
            ) : null
          }
        />

        <CorrectionInstance value={index}>
          <SectionNotice variant="neutral">
            {t("demandNoticeSection_whereSeveralNoticesWentOutFor")}
          </SectionNotice>

          {/* What the cheque was meant to discharge */}
          <FormCard
            title={t("demandNoticeSection_natureOfDebt")}
            description={t("demandNoticeSection_theDebtOrLiabilityTheCheque")}
          >
            <FormRow>
              <FormField
                label={t("demandNoticeSection_natureOfDebtOrOtherLiability")}
                name="natureDebt"
                required
                tip={t("demandNoticeSection_theLegallyEnforceableDebtOrLiability")}
              >
                <OptionSelect
                  value={notice.natureDebt}
                  onValueChange={(v) => editField("natureDebt", v)}
                  options={NATURE_OF_DEBT}
                  ariaLabel={t("demandNoticeSection_natureOfDebtOrOtherLiability")}
                />
              </FormField>
            </FormRow>
          </FormCard>

          {/* The notice itself, and how it was served */}
          <FormCard
            title={t("demandNoticeSection_legalDemandNotice")}
            description={t("demandNoticeSection_theStatutoryNoticeDemandingPaymentSent")}
          >
            <FormRow>
              <FormField
                label={t("demandNoticeSection_dateOfDispatchOfDemandNotice")}
                name="dispatchDate"
                required
                error={noticeDispatchIssue(draft, index)}
                tip={t("demandNoticeSection_theNoticeMustBeSentWithin")}
              >
                <DateField
                  value={notice.dispatchDate}
                  onChange={(v) => editField("dispatchDate", v)}
                  ariaLabel={t("demandNoticeSection_dateOfDispatchOfDemandNotice")}
                />
              </FormField>
              <FormField label={t("demandNoticeSection_modeOfService")} name="modeService" required>
                <OptionSelect
                  value={notice.modeService}
                  onValueChange={(v) => editField("modeService", v)}
                  options={MODE_OF_SERVICE}
                  ariaLabel={t("demandNoticeSection_modeOfService")}
                />
              </FormField>
            </FormRow>

            {noticeDispatchLate(draft, index) ? (
              <SectionNotice variant="warning">
                {t("demandNoticeSection_demandNoticeNotIssuedWithin30")}
              </SectionNotice>
            ) : null}

            <HalfWidth>
              <FormField
                label={t("demandNoticeSection_trackingNumber")}
                name="tracking"
                optional
                tip={t("demandNoticeSection_consignmentTrackingNumberFromThePostal")}
              >
                <TextField
                  value={notice.tracking}
                  onChange={(v) => editField("tracking", v)}
                  placeholder={t("demandNoticeSection_enterTrackingNumber")}
                  autoComplete="off"
                />
              </FormField>
            </HalfWidth>

            <FormDivider />

            <FormField
              asGroup
              label={t("demandNoticeSection_whetherDelivered")}
              name="delivered"
              required
            >
              <YesNoSegmented
                value={notice.delivered}
                onValueChange={(v) => set("delivered", v)}
                ariaLabel={t("demandNoticeSection_whetherTheDemandNoticeWasDelivered")}
              />
            </FormField>

            {notice.delivered === "yes" ? (
              <>
                <FormRow>
                  <FormField
                    name="deliveryDate"
                    label={t("demandNoticeSection_dateOfDelivery")}
                    required
                    error={noticeServiceIssue(notice)}
                    help={t("demandNoticeSection_the15DayPaymentWindowRuns")}
                  >
                    <DateField
                      value={notice.deliveryDate}
                      onChange={(v) => editField("deliveryDate", v)}
                      ariaLabel={t("demandNoticeSection_dateOfDelivery")}
                    />
                  </FormField>
                </FormRow>
                <FormField
                  asGroup
                  name="replied"
                  label={t("demandNoticeSection_hasTheAccusedRepliedToThe")}
                >
                  <YesNoSegmented
                    value={notice.replied}
                    onValueChange={(v) => set("replied", v)}
                    ariaLabel={t("demandNoticeSection_hasTheAccusedRepliedToThe")}
                  />
                </FormField>
              </>
            ) : (
              <>
                <FormRow>
                  <FormField
                    name="returnDate"
                    label={t("demandNoticeSection_dateOfReturnAsNotDelivered")}
                    required
                    error={noticeServiceIssue(notice)}
                  >
                    <DateField
                      value={notice.returnDate}
                      onChange={(v) => set("returnDate", v)}
                      ariaLabel={t("demandNoticeSection_dateOfReturnAsNotDelivered")}
                    />
                  </FormField>
                  <FormField
                    label={t("demandNoticeSection_reasonForNonDelivery")}
                    name="nonDeliveryReason"
                    required
                  >
                    <OptionSelect
                      value={notice.nonDeliveryReason}
                      onValueChange={(v) => set("nonDeliveryReason", v)}
                      options={NON_DELIVERY_REASONS}
                      ariaLabel={t("demandNoticeSection_reasonForNonDelivery")}
                    />
                  </FormField>
                </FormRow>
                <SectionNotice variant="info">
                  {t("demandNoticeSection_aNoticeReturnedUnservedCanStill")}
                </SectionNotice>
              </>
            )}
          </FormCard>

          {/* Anything already paid comes off the claim */}
          <FormCard
            title={t("demandNoticeSection_paymentAgainstTheCheque")}
            description={t("demandNoticeSection_whetherTheAccusedHasPaidAny")}
          >
            <HalfWidth>
              <FormField
                name="paymentStatus"
                label={t("demandNoticeSection_hasTheDrawerAccusedMadeFull")}
                required
                tip={t("demandNoticeSection_ifAnyAmountHasAlreadyBeen")}
              >
                <OptionSelect
                  value={notice.paymentStatus}
                  onValueChange={(v) =>
                    set("paymentStatus", v as DemandNotice["paymentStatus"])
                  }
                  options={PAYMENT_STATUS}
                  ariaLabel={t("demandNoticeSection_hasTheDrawerAccusedMadeFull")}
                />
              </FormField>
            </HalfWidth>

            {notice.paymentStatus === "part" ? (
              <HalfWidth>
                <FormField
                  name="partAmount"
                  label={t("demandNoticeSection_howMuchPaymentHasAlreadyBeen")}
                  required
                  help={t("demandNoticeSection_deductedFromTheChequeAmountTo")}
                >
                  <PrefixInput
                    prefix="₹"
                    value={notice.partAmount}
                    onChange={(v) => set("partAmount", v)}
                    placeholder={t("demandNoticeSection_amountPaidSoFar")}
                    inputMode="numeric"
                  />
                </FormField>
              </HalfWidth>
            ) : null}
          </FormCard>
        </CorrectionInstance>

        {error ? (
          <SectionNotice
            variant="destructive"
            title={t("demandNoticeSection_couldntSaveToTheCourtsServer")}
          >
            {error}
          </SectionNotice>
        ) : null}
      </FilingMain>

      <FilingFooter
        backHref={prev ? hrefFor(prev) : undefined}
        onContinue={continueHref ? handleContinue : undefined}
        continueDisabled={saving}
        continueLabel={saving ? t("demandNoticeSection_saving") : t("demandNoticeSection_continue")}
      />

      <ConfirmDialog
        note={t("demandNoticeSection_thisCannotBeUndone")}
        open={removeOpen}
        onOpenChange={setRemoveOpen}
        title={t("demandNoticeSection_removeDemandNoticeValue", { value: String(removeIndex + 1) })}
        description={t("demandNoticeSection_areYouSureYouWantTo")}
        confirmLabel={t("demandNoticeSection_yesRemove")}
        onConfirm={confirmRemove}
      />

      <SourcePanel
        open={sourceOpen}
        onOpenChange={setSourceOpen}
        title={sourceSlot?.label ?? DOC_LABELS[sourceDoc]}
        chips={uploadedDocs.map((doc) => ({
          id: doc,
          label: slots[doc]?.file?.name ?? slots[doc]?.label ?? DOC_LABELS[doc],
          active: doc === sourceDoc,
          onClick: () => setSourceDoc(doc),
        }))}
        file={sourceSlot?.file ?? null}
        uploadHref={hrefFor("upload")}
        imageAlt={`Uploaded ${sourceSlot?.label ?? "document"}`}
        note={t("demandNoticeSection_shownFromYourUploadedDocument")}
      />
    </>
  );
}
