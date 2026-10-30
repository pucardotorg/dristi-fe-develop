"use client";

/**
 * Demand notice & debt — the statutory notice and the debt the cheque was meant to clear.
 *
 * The uploaded notice, postal receipt and AD card can be opened beside the form. Service
 * branches on whether the notice was delivered.
 */

import * as React from "react";

import { blankNotice, removeCaseRecord } from "@/lib/filing/blank";
import { getRepository } from "@/lib/filing/data";
import { forgetFile } from "@/lib/filing/files";
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
import type { DemandNotice, NoticeField } from "@/lib/filing/types";
import { ConfirmDialog } from "@/components/filing/confirm-dialog";
import { DateField } from "@/components/filing/date-field";
import { FilingFooter } from "@/components/filing/filing-footer";
import { FilingPageHeader } from "@/components/filing/filing-page-header";
import { FilingMain } from "@/components/filing/filing-shell";
import { FormCard, FormDivider, FormRow, HalfWidth } from "@/components/filing/form-card";
import { FormField } from "@/components/filing/form-field";
import {
  CorrectionInstance,
  useCorrectionInstanceRequest,
} from "@/components/filing/posture";
import { OptionSelect, PrefixInput, TextField } from "@/components/filing/inputs";
import { SectionNotice } from "@/components/filing/notices";
import { SectionTabs } from "@/components/filing/section-tabs";
import { YesNoSegmented } from "@/components/filing/segmented";
import {
  SourcePanel,
  ViewSourceButton,
  useSourceOpenState,
} from "@/components/filing/source-panel";

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
  const { draft, update, hrefFor } = useFiling();
  const { prev, next } = neighbours("demand-notice");
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
  const [sourceDoc, setSourceDoc] = React.useState<keyof typeof DOC_LABELS>("demand-notice");

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
    (doc) => slots[doc]?.file
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
    if (notices.length <= 1) return;
    // Its upload group goes with it, so the list of documents stops asking for it.
    let files: ReturnType<typeof removeCaseRecord> = [];
    update((d) => {
      files = removeCaseRecord(d, "notice", i);
    });
    for (const f of files) {
      forgetFile(f.id);
      void getRepository().deleteFile(f.id);
    }
    const remaining = notices.length - 1;
    let a = index;
    if (i < a) a -= 1;
    if (a >= remaining) a = remaining - 1;
    setActive(Math.max(0, a));
  };

  return (
    <>
      <FilingMain sourceOpen={sourceOpen}>
        <FilingPageHeader
          title="Demand notice & debt"
          description="Details of the statutory demand notice sent to the accused, and the debt the cheque was meant to discharge."
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
          addLabel="Add demand notice"
          onAdd={addNotice}
          trailing={
            !sourceOpen ? (
              <ViewSourceButton onClick={() => setSourceOpen(true)} />
            ) : null
          }
        />

        <CorrectionInstance value={index}>

        <SectionNotice variant="neutral">
          Where several notices went out for one cheque, use the one issued within 30
          days of the return. Add a notice per cheque.
        </SectionNotice>

        {/* What the cheque was meant to discharge */}
        <FormCard
          title="Nature of debt"
          description="The debt or liability the cheque was meant to discharge."
        >
          <FormRow>
            <FormField
              label="Nature of debt or other liability"
              name="natureDebt"
              required
              tip="The legally enforceable debt or liability that existed when the cheque was issued."
            >
              <OptionSelect
                value={notice.natureDebt}
                onValueChange={(v) => editField("natureDebt", v)}
                options={NATURE_OF_DEBT}
                ariaLabel="Nature of debt or other liability"
              />
            </FormField>
          </FormRow>
        </FormCard>

        {/* The notice itself, and how it was served */}
        <FormCard
          title="Legal demand notice"
          description="The statutory notice demanding payment, sent after the cheque was dishonoured."
        >
          <FormRow>
            <FormField
              label="Date of dispatch of demand notice"
              name="dispatchDate"
              required
              error={noticeDispatchIssue(draft, index)}
              tip="The notice must be sent within 30 days of the cheque's return."
            >
              <DateField
                value={notice.dispatchDate}
                onChange={(v) => editField("dispatchDate", v)}
                ariaLabel="Date of dispatch of demand notice"
              />
            </FormField>
            <FormField label="Mode of service" name="modeService" required>
              <OptionSelect
                value={notice.modeService}
                onValueChange={(v) => editField("modeService", v)}
                options={MODE_OF_SERVICE}
                ariaLabel="Mode of service"
              />
            </FormField>
          </FormRow>

          {noticeDispatchLate(draft, index) ? (
            <SectionNotice variant="warning">
              Demand notice not issued within 30 days of the return of the cheque as unpaid.
            </SectionNotice>
          ) : null}

          <HalfWidth>
            <FormField
              label="Tracking number"
              name="tracking"
              optional
              tip="Consignment / tracking number from the postal or courier receipt."
            >
              <TextField
                value={notice.tracking}
                onChange={(v) => editField("tracking", v)}
                placeholder="Enter tracking number"
                autoComplete="off"
              />
            </FormField>
          </HalfWidth>

          <FormDivider />

          <FormField asGroup label="Whether delivered?" name="delivered" required>
            <YesNoSegmented
              value={notice.delivered}
              onValueChange={(v) => set("delivered", v)}
              ariaLabel="Whether the demand notice was delivered?"
            />
          </FormField>

          {notice.delivered === "yes" ? (
            <>
              <FormRow>
                <FormField name="deliveryDate"
                  label="Date of delivery"
                  required
                  error={noticeServiceIssue(notice)}
                  help="The 15-day payment window runs from this date."
                >
                  <DateField
                    value={notice.deliveryDate}
                    onChange={(v) => editField("deliveryDate", v)}
                    ariaLabel="Date of delivery"
                  />
                </FormField>
              </FormRow>
              <FormField asGroup name="replied" label="Has the accused replied to the demand notice?">
                <YesNoSegmented
                  value={notice.replied}
                  onValueChange={(v) => set("replied", v)}
                  ariaLabel="Has the accused replied to the demand notice?"
                />
              </FormField>
            </>
          ) : (
            <>
              <FormRow>
                <FormField name="returnDate"
                  label="Date of return as not delivered"
                  required
                  error={noticeServiceIssue(notice)}
                >
                  <DateField
                    value={notice.returnDate}
                    onChange={(v) => set("returnDate", v)}
                    ariaLabel="Date of return as not delivered"
                  />
                </FormField>
                <FormField label="Reason for non-delivery" name="nonDeliveryReason" required>
                  <OptionSelect
                    value={notice.nonDeliveryReason}
                    onValueChange={(v) => set("nonDeliveryReason", v)}
                    options={NON_DELIVERY_REASONS}
                    ariaLabel="Reason for non-delivery"
                  />
                </FormField>
              </FormRow>
              <SectionNotice variant="info">
                A notice returned unserved can still count as valid service, if it was
                correctly addressed and dispatched. Keep the envelope and the tracking
                record.
              </SectionNotice>
            </>
          )}
        </FormCard>

        {/* Anything already paid comes off the claim */}
        <FormCard
          title="Payment against the cheque"
          description="Whether the accused has paid any part of the cheque amount."
        >
          <HalfWidth>
            <FormField name="paymentStatus"
              label="Has the drawer (accused) made full or part payment due under the cheque?"
              required
              tip="If any amount has already been paid, the balance due is what is claimed in the complaint."
            >
              <OptionSelect
                value={notice.paymentStatus}
                onValueChange={(v) =>
                  set("paymentStatus", v as DemandNotice["paymentStatus"])
                }
                options={PAYMENT_STATUS}
                ariaLabel="Has the drawer (accused) made full or part payment due under the cheque?"
              />
            </FormField>
          </HalfWidth>

          {notice.paymentStatus === "part" ? (
            <HalfWidth>
              <FormField name="partAmount"
                label="How much payment has already been made?"
                required
                help="Deducted from the cheque amount to arrive at the balance claimed."
              >
                <PrefixInput
                  prefix="₹"
                  value={notice.partAmount}
                  onChange={(v) => set("partAmount", v)}
                  placeholder="Amount paid so far"
                  inputMode="numeric"
                />
              </FormField>
            </HalfWidth>
          ) : null}
        </FormCard>
        </CorrectionInstance>
      </FilingMain>

      <FilingFooter
        backHref={prev ? hrefFor(prev) : undefined}
        continueHref={next ? hrefFor(next) : undefined}
      />

      <ConfirmDialog
        open={removeOpen}
        onOpenChange={setRemoveOpen}
        title={`Remove demand notice ${removeIndex + 1}`}
        description="Are you sure you want to delete the details of this demand notice and any documents added for it? This cannot be undone."
        confirmLabel="Yes, remove"
        onConfirm={confirmRemove}
      />

      <SourcePanel
        open={sourceOpen}
        onOpenChange={setSourceOpen}
        title={sourceSlot?.label ?? DOC_LABELS[sourceDoc]}
        chips={uploadedDocs.map((doc) => ({
          label: slots[doc]?.file?.name ?? slots[doc]?.label ?? DOC_LABELS[doc],
          active: doc === sourceDoc,
          onClick: () => setSourceDoc(doc),
        }))}
        file={sourceSlot?.file ?? null}
        uploadHref={hrefFor("upload")}
        imageAlt={`Uploaded ${sourceSlot?.label ?? "document"}`}
        note="Shown from your uploaded document."
      />
    </>
  );
}
