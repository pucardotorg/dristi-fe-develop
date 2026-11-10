"use client";
import {useTranslations as __useTranslations} from "@/i18n/use-translations";
import {LocalizedText as __LocalizedText} from "@/components/localized-text";

import * as React from "react";

import { OrderDatePicker } from "@/components/employee/order-item-fields";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  SegmentedControl,
  SegmentedControlItem,
} from "@/components/ui/segmented-control";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  APPLICATION_DECISIONS,
  applicationOutcomeGaps,
  setApplicationOutcome,
  type ApplicationOutcome,
  type YesNo,
} from "@/lib/employee/application-outcome";

/** What the order data knows of the application its Application item answers. */
export type ApplicationOutcomeSubject = {
  /** "Postpone" — the item's own line in the list. */
  label: string;
  /** Onboarded already: Onboard reads yes and cannot be changed. */
  onboarded: boolean;
  /** The workflow its type sets moving, by its catalogue name, or none. */
  workflow: string | null;
};

/**
 * The Application item's pop-up (`lib/employee/application-outcome.ts`). Each question
 * shows only once the answer before it calls for it; Save waits for every one shown.
 */
export function ApplicationOutcomeDialog({
  open,
  subject,
  outcome,
  today,
  onOpenChange,
  onSave,
}: {
  open: boolean;
  subject: ApplicationOutcomeSubject;
  outcome: ApplicationOutcome;
  today: string;
  onOpenChange: (open: boolean) => void;
  onSave: (outcome: ApplicationOutcome) => void;
}) {
  const __t = __useTranslations();
  const [answers, setAnswers] = React.useState(outcome);
  /* Opened afresh: start from what the order data holds. */
  const [wasOpen, setWasOpen] = React.useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setAnswers(outcome);
  }
  const id = React.useId();
  const gaps = applicationOutcomeGaps(answers, Boolean(subject.workflow));
  const change = (next: Partial<ApplicationOutcome>) =>
    setAnswers((current) => setApplicationOutcome(current, next));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90dvh] flex-col gap-4 sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-title-s font-semibold">
            {<__LocalizedText id="applicationOutcomeDialog_application" />}{" "}{__t(subject.label)}
          </DialogTitle>
          <DialogDescription>
            {<__LocalizedText id="applicationOutcomeDialog_recordedInThisOrderSDataThe" />}{" "}</DialogDescription>
        </DialogHeader>
        {/* `-mx-1 px-1`: room for the fields' focus rings inside the scroll. */}
        <div className="-mx-1 flex min-h-0 flex-col gap-6 overflow-y-auto px-1 pb-1">
          <YesNoQuestion
            id={`${id}-onboard`}
            label={__t("applicationOutcomeDialog_onboardTheApplication")}
            note={subject.onboarded ? __t("applicationOutcomeDialog_alreadyOnboarded") : undefined}
            value={answers.onboard}
            disabled={subject.onboarded}
            onChange={(onboard) => change({ onboard })}
          />
          <YesNoQuestion
            id={`${id}-decided`}
            label={__t("applicationOutcomeDialog_wasADecisionPassedOnTheApplication")}
            value={answers.decided}
            onChange={(decided) => change({ decided })}
          />

          {answers.decided === "yes" ? (
            <>
              <div className="flex min-w-0 flex-col gap-2">
                <span
                  id={`${id}-decision`}
                  className="text-body-compact font-medium"
                >
                  {<__LocalizedText id="applicationOutcomeDialog_whatWasDecided" />}{" "}</span>
                <Select
                  value={answers.decision || undefined}
                  onValueChange={(decision) =>
                    change({
                      decision: decision as ApplicationOutcome["decision"],
                    })
                  }
                >
                  <SelectTrigger
                    aria-labelledby={`${id}-decision`}
                    className="w-full"
                  >
                    <SelectValue placeholder={__t("applicationOutcomeDialog_chooseOne")}>
                      {__t(APPLICATION_DECISIONS.find(
                        (entry) => entry.id === answers.decision,
                      )?.label) ?? null}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {APPLICATION_DECISIONS.map((entry) => (
                      <SelectItem key={entry.id} value={entry.id}>
                        {__t(entry.label)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {subject.workflow ? (
                <YesNoQuestion
                  id={`${id}-workflow`}
                  label={__t("applicationOutcomeDialog_wasTheWorkflowForThisApplicationTriggered")}
                  note={subject.workflow}
                  value={answers.workflowTriggered}
                  onChange={(workflowTriggered) =>
                    change({ workflowTriggered })
                  }
                />
              ) : null}
            </>
          ) : null}

          {answers.decided === "no" ? (
            <>
              <YesNoQuestion
                id={`${id}-respond`}
                label={__t("applicationOutcomeDialog_doesTheOtherPartyNeedToRespond")}
                value={answers.responseNeeded}
                onChange={(responseNeeded) => change({ responseNeeded })}
              />
              {answers.responseNeeded === "yes" ? (
                <OrderDatePicker
                  id={`${id}-respond-by`}
                  label={
                    <span
                      id={`${id}-respond-by-label`}
                      className="text-body-compact font-medium"
                    >
                      {<__LocalizedText id="applicationOutcomeDialog_respondBy" />}{" "}</span>
                  }
                  value={answers.respondBy}
                  today={today}
                  disabled={false}
                  onChange={(respondBy) => change({ respondBy })}
                />
              ) : null}
              <OrderDatePicker
                id={`${id}-forward`}
                label={
                  <span
                    id={`${id}-forward-label`}
                    className="text-body-compact font-medium"
                  >
                    {<__LocalizedText id="applicationOutcomeDialog_bringTheApplicationForwardAgainOn" />}{" "}</span>
                }
                value={answers.bringForwardOn}
                today={today}
                disabled={false}
                onChange={(bringForwardOn) => change({ bringForwardOn })}
              />
            </>
          ) : null}
        </div>
        <DialogFooter className="sm:items-center">
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => onOpenChange(false)}
          >
            {<__LocalizedText id="applicationOutcomeDialog_cancel" />}{" "}</Button>
          <Button
            type="button"
            className="w-full sm:w-auto"
            disabled={gaps.length > 0}
            onClick={() => onSave(answers)}
          >
            {<__LocalizedText id="applicationOutcomeDialog_save" />}{" "}</Button>
          {gaps.length > 0 ? (
            <Badge
              variant="warning"
              className="self-start tabular-nums sm:order-first sm:mr-auto sm:self-auto"
            >
              {gaps.length} {<__LocalizedText id="applicationOutcomeDialog_toFill" />}{" "}</Badge>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** A yes-or-no question, as the order items ask an either/or. */
function YesNoQuestion({
  id,
  label,
  note,
  value,
  disabled = false,
  onChange,
}: {
  id: string;
  label: string;
  /** A quiet line under the question. */
  note?: string;
  value: YesNo | "";
  disabled?: boolean;
  onChange: (value: YesNo) => void;
}) {
  const __t = __useTranslations();
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <span id={id} className="flex flex-col gap-0.5">
        <span className="text-body-compact font-medium">{__t(label)}</span>
        {note ? (
          <span className="text-caption text-muted-foreground">{__t(note)}</span>
        ) : null}
      </span>
      <SegmentedControl
        type="single"
        aria-labelledby={id}
        value={value}
        disabled={disabled}
        /* Radix hands back "" when the chosen segment is pressed again: the answer stays. */
        onValueChange={(next) => {
          if (next) onChange(next as YesNo);
        }}
        className="w-full"
      >
        <SegmentedControlItem value="yes" className="flex-1">
          {<__LocalizedText id="applicationOutcomeDialog_yes" />}{" "}</SegmentedControlItem>
        <SegmentedControlItem value="no" className="flex-1">
          {<__LocalizedText id="applicationOutcomeDialog_no" />}{" "}</SegmentedControlItem>
      </SegmentedControl>
    </div>
  );
}
