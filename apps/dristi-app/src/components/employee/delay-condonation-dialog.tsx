"use client";

import { useMemo } from "react";

import { ReviewRow } from "@/components/cases/filing-form-shared";
import { ApplicationReviewOverlay } from "@/components/employee/application-review-dialog";
import { Dialog } from "@/components/ui/dialog";
import {
  DELAY_CONDONATION_TYPE_LABEL,
  buildDelayCondonationDocument,
  delayCondonationFiler,
  delayCondonationStageLabel,
  delayLine,
  downloadDelayCondonationDocument,
  formatDelayCondonationLongDate,
  type DelayCondonationCase,
} from "@/lib/employee/delay-condonation";
import { causeTitle } from "@/lib/employee/hearings";
import { Identifier } from "@/components/chrome/identifier";
import { useTranslations } from "next-intl";

/**
 * One delay-condonation application, read and then allowed or refused.
 *
 * The same overlay as `ReschedulingRequestDialog`, because it is the same job: an
 * application somebody filed, in front of a bench that has to say yes or no. What is
 * particular to this queue is the one fact everything turns on — how long the delay is
 * and what it is a delay in — so the well states it as a sentence rather than leaving
 * the bench to assemble it from a number and a phrase.
 *
 * **Approve and Reject perform no judicial act.** Condoning delay is a real one
 * (`order-for-acceptance-rejection-of-delay-condonation`) and this build performs none:
 * both buttons drop the row from the demo queue and close. No order is drawn, nothing is
 * written and nobody is told.
 */
export function DelayCondonationDialog({
  matter,
  onOpenChange,
  onApprove,
  onReject,
  onReturnFocus,
}: {
  matter: DelayCondonationCase | null;
  onOpenChange: (matter: DelayCondonationCase | null) => void;
  onApprove: (matter: DelayCondonationCase) => void;
  onReject: (matter: DelayCondonationCase) => void;
  onReturnFocus: () => void;
}) {
  return (
    <Dialog
      open={matter !== null}
      onOpenChange={(next) => {
        if (!next) onOpenChange(null);
      }}
    >
      {matter ? (
        /* Keyed on the application so opening a second one starts fresh rather than
           inheriting the last one's scroll position. */
        <MatterBody
          key={matter.id}
          matter={matter}
          onApprove={onApprove}
          onReject={onReject}
          onReturnFocus={onReturnFocus}
        />
      ) : null}
    </Dialog>
  );
}

function MatterBody({
  matter,
  onApprove,
  onReject,
  onReturnFocus,
}: {
  matter: DelayCondonationCase;
  onApprove: (matter: DelayCondonationCase) => void;
  onReject: (matter: DelayCondonationCase) => void;
  onReturnFocus: () => void;
}) {
  const t = useTranslations();
  const document = useMemo(() => buildDelayCondonationDocument(matter), [matter]);

  return (
    <ApplicationReviewOverlay
      title={t(DELAY_CONDONATION_TYPE_LABEL)}
      description={
        <>
          {/* The overlay renders this as its accessible description. */}
          <Identifier
            value={matter.caseNumber}
            label={t("delayCondonationDialog_caseNumber")}
            copyable={false}
          />
          {" · "}
          {causeTitle(matter)}
        </>
      }
      facts={
        <>
          <ReviewRow term={t("delayCondonationDialog_applicationType")}>
            {t(DELAY_CONDONATION_TYPE_LABEL)}
          </ReviewRow>
          <ReviewRow term={t("delayCondonationDialog_caseNumberTerm")}>
            <Identifier value={matter.caseNumber} label={t("delayCondonationDialog_caseNumber")} />
          </ReviewRow>
          <ReviewRow term={t("delayCondonationDialog_stage")}>
            {delayCondonationStageLabel(matter.stage)}
          </ReviewRow>
          <ReviewRow term={t("delayCondonationDialog_delayToBeCondoned")}>
            {delayLine(matter)}
          </ReviewRow>
          <ReviewRow term={t("delayCondonationDialog_dateOfApplication")}>
            <span className="tabular-nums">{formatDelayCondonationLongDate(matter.appliedOn)}</span>
          </ReviewRow>
          <ReviewRow term={t("delayCondonationDialog_applicationFiler")}>
            {delayCondonationFiler(matter)}
          </ReviewRow>
        </>
      }
      document={document}
      onDownload={() => downloadDelayCondonationDocument(matter)}
      onApprove={() => onApprove(matter)}
      onReject={() => onReject(matter)}
      onReturnFocus={onReturnFocus}
    />
  );
}
