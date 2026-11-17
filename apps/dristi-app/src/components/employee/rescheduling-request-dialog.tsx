"use client";

import { useMemo } from "react";

import { ReviewRow } from "@/components/cases/filing-form-shared";
import { ApplicationReviewOverlay } from "@/components/employee/application-review-dialog";
import { Dialog } from "@/components/ui/dialog";
import { courtHearingPurposeLabel } from "@/lib/employee/hearings";
import {
  APPLICATION_TYPE_LABEL,
  buildReschedulingDocument,
  consentLabel,
  downloadReschedulingDocument,
  formatProposedDates,
  formatRequestLongDate,
  senderLine,
  type ReschedulingRequest,
} from "@/lib/employee/rescheduling-request";
import { Identifier } from "@/components/chrome/identifier";
import { useTranslations } from "next-intl";

/**
 * One rescheduling application, in the shared court-side review overlay, with the
 * Approve / Reject the bench needs.
 *
 * The document is the thing being reviewed, so it fills the overlay's `1fr` row;
 * the facts sit in a compact sunken well above it, not a nine-row list that ate
 * the paper. The overlay itself is `ApplicationReviewOverlay`, shared with the
 * delay-condonation and Others queues — this file is now only what is particular
 * to a request to move a date. Approve and Reject only leave the demo queue.
 */
export function ReschedulingRequestDialog({
  request,
  onOpenChange,
  onApprove,
  onReject,
  onReturnFocus,
}: {
  request: ReschedulingRequest | null;
  onOpenChange: (request: ReschedulingRequest | null) => void;
  onApprove: (request: ReschedulingRequest) => void;
  onReject: (request: ReschedulingRequest) => void;
  onReturnFocus: () => void;
}) {
  return (
    <Dialog
      open={request !== null}
      onOpenChange={(next) => {
        if (!next) onOpenChange(null);
      }}
    >
      {request ? (
        <RequestBody
          key={request.id}
          request={request}
          onApprove={onApprove}
          onReject={onReject}
          onReturnFocus={onReturnFocus}
        />
      ) : null}
    </Dialog>
  );
}

function RequestBody({
  request,
  onApprove,
  onReject,
  onReturnFocus,
}: {
  request: ReschedulingRequest;
  onApprove: (request: ReschedulingRequest) => void;
  onReject: (request: ReschedulingRequest) => void;
  onReturnFocus: () => void;
}) {
  const t = useTranslations();
  const document = useMemo(() => buildReschedulingDocument(request), [request]);
  const listedOn = formatRequestLongDate(request.listedOn);
  const purpose = courtHearingPurposeLabel(request.purpose);
  const currentHearing = `${listedOn} · ${purpose}`;

  return (
    <ApplicationReviewOverlay
      title={APPLICATION_TYPE_LABEL}
      description={senderLine(request)}
      facts={
        <>
          <ReviewRow term={t("reschedulingRequestDialog_caseNumber")}>
            <Identifier
              value={request.caseNumber}
              label={t("reschedulingRequestDialog_caseNumberLabel")}
            />
          </ReviewRow>
          <ReviewRow term={t("reschedulingRequestDialog_applicationSentOn")}>
            {formatRequestLongDate(request.appliedOn)}
          </ReviewRow>
          <ReviewRow term={t("reschedulingRequestDialog_currentHearing")}>
            {currentHearing}
          </ReviewRow>
          <ReviewRow term={t("reschedulingRequestDialog_proposedHearingDate")}>
            {formatProposedDates(request.proposedOn)}
          </ReviewRow>
          <ReviewRow term={t("reschedulingRequestDialog_consentOfOtherParties")}>
            {consentLabel(request.partiesAgreed)}
          </ReviewRow>
        </>
      }
      document={document}
      onDownload={() => downloadReschedulingDocument(request)}
      onApprove={() => onApprove(request)}
      onReject={() => onReject(request)}
      onReturnFocus={onReturnFocus}
    />
  );
}
