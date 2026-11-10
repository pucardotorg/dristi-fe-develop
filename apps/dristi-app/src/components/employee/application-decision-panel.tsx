"use client";
import {useTranslations as __useTranslations} from "@/i18n/use-translations";
import {LocalizedText as __LocalizedText} from "@/components/localized-text";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Identifier } from "@/components/chrome/identifier";
import {
  ApplicationQuickOrder,
  type QuickOrderRequest,
} from "@/components/employee/application-quick-order";
import { ListingDateField } from "@/components/employee/listing-date-field";
import { useCourtRole } from "@/components/employee/use-court-role";
import { useOrderSigning } from "@/components/employee/use-order-signing";
import { usePendingOrders } from "@/components/employee/use-pending-orders";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import {
  SegmentedControl,
  SegmentedControlItem,
} from "@/components/ui/segmented-control";
import {
  canDraftOrder,
  canSignOrder,
  acceptanceNeedsHearingDate,
  canTakeSystemAction,
  decisionText,
  discardOrder,
  dismissalText,
  objectionDeadline,
  setADateUsed,
  signOrder,
  type CourtSeat,
  type LifecycleApplication,
} from "@/lib/applications/lifecycle";
import {
  allotOrderId,
  applyStep,
  type Result,
} from "@/lib/applications/store";
import { formatCaseDate } from "@/lib/cases/types";
import { applicationOrderHref } from "@/lib/employee/application-order-decision";
import { nextApplicationOrderKey } from "@/lib/employee/application-order-draft";
import {
  initialApplicationOutcome,
  setApplicationOutcome,
  type ApplicationOutcome,
} from "@/lib/employee/application-outcome";
import { queueOf, shortDate } from "@/lib/employee/application-queue";
import { caseOf, nextHearingOf } from "@/lib/employee/application-tasks";
import { orderDraftKey } from "@/lib/employee/order-door";
import { EMPTY_ORDER_DRAFT } from "@/lib/employee/order-draft";
import { updateOrderDraft } from "@/lib/employee/order-drafts";
import {
  pendingOrderHref,
  pendingOrderStage,
  pendingOrderStageLabel,
} from "@/lib/employee/pending-orders";

/* ─────────────────────────────── what can be done with it ──────────────────────────── */

/** One answer to the panel's question, from its one segmented control. */
type Choice = "onboard" | "defer" | "dismiss" | "accept" | "reject" | "move" | "list";

type Panel = {
  /** The option chosen in the panel's segmented control; none yet on a decision. */
  choice: Choice | null;
  /** Onboarding: list it for a date, or take it up now. */
  when: "date" | "now";
  /** A listing date — on onboarding, or listing one taken up today after all. */
  date: Date | undefined;
  invite: boolean;
  defer: Date | undefined;
  /** Relisting one listed ahead, or moving the date of one due. */
  relist: Date | undefined;
};

const CHOICE_LABEL: Record<Choice, string> = {
  onboard: "Onboard",
  defer: "Defer review",
  dismiss: "Dismiss",
  accept: "Accept",
  reject: "Reject",
  move: "Move date",
  list: "List for a date",
};

function dayOfDate(date: Date | undefined): string {
  if (!date) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function dateOfDay(day: string | undefined): Date | undefined {
  if (!day) return undefined;
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/**
 * The right-hand panel: one question for this application, answered here.
 *
 * **One pattern for every open state** (owner, 2026-10-15): the heading, one segmented
 * control of what can be done, the chosen option's fields under it, and one primary at
 * the foot naming the date or the act. Changing your mind is picking another segment —
 * there is no Back and no banner link — and what was entered under each stays.
 *
 * - **Pending review** — Onboard · Defer review · Dismiss, Onboard chosen (owner,
 *   2026-10-07). Onboarding asks when the court will take it up: listed for a later date
 *   (pre-filled with the next hearing, `ALC-10`; the other party asked to object by
 *   default, `ALC-11`, `ALC-25`) or taken up now (`ALC-08`). A deferred review reads the
 *   same, with the date it was deferred to.
 * - **Pending decision, due** — Accept · Reject · Move date, nothing chosen: a judgment
 *   is never answered in advance. Taken up today, the third is List for a date instead —
 *   onboarding stays done (product, 2026-10-08).
 * - **Listed ahead** — it waits for its date; only the date can change (`ALC-15`).
 * - **Closed** — the order that closed it, and what happened when.
 *
 * **Every option is the start of an order** (owner, 2026-10-21): the panel keeps main's
 * options exactly, and its answers are a subset of the order data's Application item
 * (`application-outcome.ts`). The primary writes them into that item and opens the order
 * screen; nothing moves the application here. It moves once the order is signed and its
 * order data complete (`application-outcome-steps.ts`). An order drafted here before the
 * order screen took over still shows, to sign or discard.
 *
 * Who may do what follows `ALC-22`, widened for now to the bench clerk (owner,
 * 2026-10-13): onboarding and every date are the magistrate's or bench clerk's; any court
 * seat drafts an order; only the magistrate signs it. A seat without the system acts is
 * offered only the orders.
 */
export function ApplicationDecisionPanel({
  app,
  on,
  view,
  onDone,
}: {
  app: LifecycleApplication;
  on: string;
  /** The list being worked, carried to the order screen for the way back. */
  view: string;
  /** An order passed from the quick order: say so, and move on to the next. */
  onDone: (message: string) => void;
}) {
  const __t = __useTranslations();
  const router = useRouter();
  const seat = useCourtRole() as CourtSeat;
  const mayAct = canTakeSystemAction(seat);
  const mayDraft = canDraftOrder(seat);
  const suggestion = nextHearingOf(app, on);
  const hearing = { day: suggestion };
  const queue = queueOf(app, on);

  const [panel, setPanel] = React.useState<Panel>(() => ({
    choice: app.status === "pending-review" ? (mayAct ? "onboard" : "dismiss") : null,
    when: "date",
    date: dateOfDay(suggestion),
    invite: true,
    defer: dateOfDay(suggestion),
    relist: dateOfDay(suggestion),
  }));
  const [error, setError] = React.useState<string | null>(null);
  const [quick, setQuick] = React.useState<QuickOrderRequest | null>(null);
  const record = caseOf(app);
  const other = app.side === "complainant" ? "accused" : "complainant";
  const named = `The application for ${app.typeLabel.toLowerCase()} filed on behalf of the ${app.side}`;
  /* The order already started on this application, in the editor's own list. */
  const orders = usePendingOrders();
  const signing = useOrderSigning();
  const orderKey = nextApplicationOrderKey(app);
  const started = orders[orderKey];
  const stage = started ? pendingOrderStage(started, signing) : null;
  const set = (patch: Partial<Panel>) => setPanel((current) => ({ ...current, ...patch }));

  function run(result: Result, message: string) {
    if (!result.ok) {
      setError(result.error);
      return false;
    }
    setError(null);
    toast.success(message);
    return true;
  }

  /**
   * Open the order with the panel's answers already in its Application item. Written
   * over whatever the item held, so a changed mind in the panel is what the order shows;
   * the order's text and other items stay as they were.
   */
  function toOrder(answers: Partial<ApplicationOutcome>) {
    updateOrderDraft(
      orderDraftKey(orderKey),
      (current) => ({
        ...current,
        applicationOutcome: setApplicationOutcome(initialApplicationOutcome(), answers),
      }),
      { ...EMPTY_ORDER_DRAFT, applicationOutcome: initialApplicationOutcome() },
    );
    router.push(applicationOrderHref(app.id, undefined, view));
  }

  /**
   * The quick order for a panel answer (owner, 2026-10-22): the court's words in a
   * pop-up, signed or sent from there, the full order screen a button away. Without a case
   * to frame the order, the order screen.
   */
  function order(request: QuickOrderRequest) {
    if (record) setQuick(request);
    else toOrder(request.answers);
  }

  /** The standard words for a listing, and the objection called for. */
  function listingWords(day: string, invite: boolean, lead: string): string {
    return `${lead} It shall be listed on ${formatCaseDate(day)}.${
      invite
        ? ` The ${other} may file objections, if any, by ${formatCaseDate(objectionDeadline(day))}.`
        : ""
    }`;
  }

  /** Listed for a date, the other party asked to respond by the day before, or not. */
  function listed(day: string, invite: boolean): Partial<ApplicationOutcome> {
    return {
      decided: "no",
      responseNeeded: invite ? "yes" : "no",
      respondBy: invite ? objectionDeadline(day) : "",
      bringForwardOn: day,
    };
  }

  function openOrder() {
    router.push(applicationOrderHref(app.id, undefined, view));
  }

  /* `ALC-18`: the order screen, for something else entirely. The application stays as
     it is. Last in the footer, under the one primary. */
  const differentOrder = mayDraft ? (
    <Button type="button" variant="ghost" className="w-full" onClick={() => openOrder()}>
      {<__LocalizedText id="applicationDecisionPanel_passADifferentOrderInstead" />}{" "}</Button>
  ) : null;

  let body: React.ReactNode = null;
  let footer: React.ReactNode = null;

  if (queue === "closed" || queue === "archive") {
    body = <ClosedRecord app={app} />;
  } else if (app.pendingOrder) {
    body = (
      <>
        <PanelHeading
          title={
            canSignOrder(seat)
              ? __t("applicationDecisionPanel_orderAwaitingYourSignature")
              : __t("applicationDecisionPanel_awaitingTheMagistrateSSignature")
          }
          lead={`Drafted on ${formatCaseDate(app.pendingOrder.draftedOn)}.`}
        />
        <OrderCard text={app.pendingOrder.text} />
      </>
    );
    footer = (
      <>
        {canSignOrder(seat) ? (
          <Button
            type="button"
            className="w-full"
            onClick={() => {
              const orderId = allotOrderId();
              const kind = app.pendingOrder?.kind;
              run(
                applyStep(app.id, (current) => signOrder(current, seat, orderId, on)),
                `Order ${orderId} signed. The application is ${
                  kind === "accept" ? __t("applicationDecisionPanel_accepted") : kind === "reject" ? __t("applicationDecisionPanel_rejected") : __t("applicationDecisionPanel_dismissed")
                }.`,
              );
            }}
          >
            {<__LocalizedText id="applicationDecisionPanel_signOrder" />}{" "}</Button>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          className="w-full"
          onClick={() =>
            run(applyStep(app.id, (current) => discardOrder(current, on)), "Draft discarded.")
          }
        >
          {<__LocalizedText id="applicationDecisionPanel_discardDraft" />}{" "}</Button>
      </>
    );
  } else if (started && stage && stage !== "triggered") {
    /* An order is under way: coming back here shows it, rather than asking the question
       it already answers. The application moves once that order is signed and its order
       data complete (`application-order-outcome.ts`). */
    /* Nothing to fill in, so the act sits under its heading, not at the panel's foot. */
    body = (
      <div className="flex flex-col gap-4">
        <PanelHeading
          title={__t("applicationDecisionPanel_orderInProgress")}
          lead={`${pendingOrderStageLabel(stage)}. The application moves once the order is signed.`}
        />
        <Button
          type="button"
          className="w-full"
          onClick={() =>
            router.push(stage === "drafting" ? started.orderHref : pendingOrderHref(orderKey))
          }
        >
          {<__LocalizedText id="applicationDecisionPanel_openTheOrder" />}{" "}</Button>
      </div>
    );
  } else if (app.status === "pending-review" && app.review) {
    const deferredBefore = setADateUsed(app);
    const later = app.review.dueOn > on;
    const choices: Choice[] = mayAct
      ? ["onboard", "defer", "dismiss"]
      : mayDraft
        ? ["dismiss"]
        : [];
    const choice = panel.choice && choices.includes(panel.choice) ? panel.choice : null;
    body = (
      <>
        <div className="flex flex-col gap-4">
          <PanelHeading
            title={__t("applicationDecisionPanel_actionOnTheApplication")}
            lead={later ? `Review deferred to ${formatCaseDate(app.review.dueOn)}.` : undefined}
          />
          {/* A choice of one is no choice: a seat that can only dismiss is not shown a
              control with one segment, only the act. */}
          {choices.length > 1 ? (
            <Choices value={choice} choices={choices} onChange={(next) => set({ choice: next })} />
          ) : null}
        </div>

        {choice === "onboard" ? (
          <>
            <Field>
              <FieldLabel id={`${app.id}-when`}>{<__LocalizedText id="applicationDecisionPanel_whenWillItBeDecided" />}</FieldLabel>
              <SegmentedControl
                type="single"
                size="compact"
                value={panel.when}
                onValueChange={(value) => {
                  if (value) set({ when: value as Panel["when"] });
                }}
                aria-labelledby={`${app.id}-when`}
                className="w-full [&>*]:flex-1 [&>*>span]:w-full"
              >
                <SegmentedControlItem value="date" className="flex-1">
                  {<__LocalizedText id="applicationDecisionPanel_onADate" />}{" "}</SegmentedControlItem>
                <SegmentedControlItem value="now" className="flex-1">
                  {<__LocalizedText id="applicationDecisionPanel_today" />}{" "}</SegmentedControlItem>
              </SegmentedControl>
              {panel.when === "now" ? (
                <FieldDescription>
                  {<__LocalizedText id="applicationDecisionPanel_itIsNumberedNowAndYouAccept" />}{" "}</FieldDescription>
              ) : null}
            </Field>
            {panel.when === "date" ? (
              <ListingFields
                idPrefix={`${app.id}-list`}
                date={panel.date}
                invite={panel.invite}
                hearing={hearing}
                on={on}
                onDate={(date) => set({ date })}
                onInvite={(invite) => set({ invite })}
              />
            ) : null}
          </>
        ) : null}

        {choice === "defer" ? (
          <>
            {deferredBefore ? (
              <Banner variant="warning">
                {<__LocalizedText id="applicationDecisionPanel_reviewOfThisApplicationHasAlreadyBeen" />}{" "}</Banner>
            ) : null}
            <ListingDateField
              id={`${app.id}-defer`}
              label={__t("applicationDecisionPanel_deferReviewTo")}
              value={panel.defer}
              on={on}
              hearing={hearing}
              onChange={(defer) => set({ defer })}
            />
          </>
        ) : null}
      </>
    );

    let primary: React.ReactNode = null;
    if (choice === "onboard") {
      const listedOn = dayOfDate(panel.date);
      const valid = panel.when === "now" || (listedOn && listedOn > on);
      primary = (
        <Button
          type="button"
          className="w-full"
          disabled={!valid}
          onClick={() =>
            /* Taken up today, the decision is the order's: the order screen. */
            panel.when === "now"
              ? toOrder({ onboard: "yes" })
              : order({
                  title: __t("applicationDecisionPanel_onboardAndList"),
                  text: listingWords(listedOn, panel.invite, `${named} is taken on file.`),
                  answers: { onboard: "yes", ...listed(listedOn, panel.invite) },
                })
          }
        >
          {panel.when === "now"
            ? __t("applicationDecisionPanel_onboardAndDecideNow")
            : listedOn
              ? __t("applicationDecisionPanel_onboardAndListOnValue0", {value0: String(shortDate(listedOn))})
              : __t("applicationDecisionPanel_onboard_98494531")}
        </Button>
      );
    } else if (choice === "defer") {
      const deferOn = dayOfDate(panel.defer);
      primary = (
        <Button
          type="button"
          className="w-full"
          disabled={!deferOn || deferOn <= on}
          onClick={() =>
            order({
              title: __t("applicationDecisionPanel_deferReview"),
              text: __t("applicationDecisionPanel_reviewOfValue0Value1IsDeferredTo", {value0: String(named.charAt(0).toLowerCase()), value1: String(named.slice(1)), value2: String(formatCaseDate(deferOn))}),
              answers: {
                onboard: "no",
                decided: "no",
                responseNeeded: "no",
                bringForwardOn: deferOn,
              },
            })
          }
        >
          {deferOn ? __t("applicationDecisionPanel_deferReviewToValue0", {value0: String(shortDate(deferOn))}) : __t("applicationDecisionPanel_deferReview")}
        </Button>
      );
    } else if (choice === "dismiss") {
      primary = (
        <Button
          type="button"
          className="w-full"
          onClick={() =>
            order({
              title: __t("applicationDecisionPanel_dismissApplication"),
              text: dismissalText(app, formatCaseDate(app.submittedOn ?? app.createdOn)),
              /* [DERIVED] Disposed: the decision list has no Dismissed. */
              answers: { onboard: "no", decided: "yes", decision: "disposed" },
            })
          }
        >
          {<__LocalizedText id="applicationDecisionPanel_draftDismissalOrder" />}{" "}</Button>
      );
    }
    footer = (
      <>
        {primary}
        {differentOrder}
      </>
    );
  } else if (app.status === "pending-decision" && app.decide) {
    const later = app.decide.dueOn > on;
    const takenNow = mayAct && app.decide.mode === "now" && app.onboardedOn === on;

    if (later) {
      const relistOn = dayOfDate(panel.relist);
      body = (
        <>
          <PanelHeading
            title={__t("applicationDecisionPanel_listedForValue0", {value0: String(formatCaseDate(app.decide.dueOn))})}
            lead={`Orders may be passed on or after that date${
              app.objectionsInvited ? __t("applicationDecisionPanel_onceTheTimeForObjectionsHasExpired") : ""
            }.`}
          />
          {mayAct ? (
            <ListingDateField
              id={`${app.id}-relist`}
              label={__t("applicationDecisionPanel_relistOn")}
              value={panel.relist}
              on={on}
              hearing={hearing}
              hint={
                app.objectionsInvited
                  ? __t("applicationDecisionPanel_theTimeForObjectionsMovesToThe")
                  : undefined
              }
              onChange={(relist) => set({ relist })}
            />
          ) : null}
        </>
      );
      footer = mayAct ? (
        <Button
          type="button"
          variant="outline"
          className="w-full"
          disabled={!relistOn || relistOn <= on}
          onClick={() =>
            order({
              title: __t("applicationDecisionPanel_relist"),
              text: `${named} is relisted on ${formatCaseDate(relistOn)}.`,
              answers: { decided: "no", responseNeeded: "no", bringForwardOn: relistOn },
            })
          }
        >
          {relistOn ? __t("applicationDecisionPanel_relistOnValue0", {value0: String(shortDate(relistOn))}) : __t("applicationDecisionPanel_relist")}
        </Button>
      ) : null;
    } else {
      /* A judgment, so nothing is chosen in advance, and there is no primary until it is
         (owner, 2026-10-14). */
      const choices: Choice[] = [
        ...(mayDraft ? (["accept", "reject"] as const) : []),
        ...(mayAct ? [takenNow ? ("list" as const) : ("move" as const)] : []),
      ];
      const choice = panel.choice && choices.includes(panel.choice) ? panel.choice : null;
      body = (
        <>
          <div className="flex flex-col gap-4">
            <PanelHeading
              title={__t("applicationDecisionPanel_actionOnTheApplication")}
              lead={
                takenNow ? (
                  <>
                    {<__LocalizedText id="applicationDecisionPanel_onboardedTodayAs" />}{" "}
                    {app.applicationNumber ? (
                      <Identifier value={app.applicationNumber} label={__t("applicationDecisionPanel_applicationNumber")} />
                    ) : null}
                  </>
                ) : undefined
              }
            />
            {choices.length > 0 ? (
              <Choices value={choice} choices={choices} onChange={(next) => set({ choice: next })} />
            ) : null}
          </div>

          {choice === "move" ? (
            <ListingDateField
              id={`${app.id}-move`}
              label={__t("applicationDecisionPanel_decideItOn")}
              value={panel.relist}
              on={on}
              hearing={hearing}
              hint={
                app.objectionsInvited
                  ? __t("applicationDecisionPanel_theTimeForObjectionsMovesToThe")
                  : undefined
              }
              onChange={(relist) => set({ relist })}
            />
          ) : null}

          {choice === "list" ? (
            <ListingFields
              idPrefix={`${app.id}-later`}
              date={panel.date}
              invite={panel.invite}
              hearing={hearing}
              on={on}
              onDate={(date) => set({ date })}
              onInvite={(invite) => set({ invite })}
            />
          ) : null}
        </>
      );

      let primary: React.ReactNode = null;
      if (choice === "accept" || choice === "reject") {
        primary = (
          <Button
            type="button"
            className="w-full"
            onClick={() =>
              order({
                title: choice === "accept" ? __t("applicationDecisionPanel_acceptApplication") : __t("applicationDecisionPanel_rejectApplication"),
                text: decisionText(app, choice),
                answers: {
                  decided: "yes",
                  decision: choice === "accept" ? "allowed" : "disallowed",
                  workflowTriggered: choice === "accept" ? "yes" : "no",
                },
                needsHearingDate:
                  choice === "accept" && acceptanceNeedsHearingDate(app.type),
              })
            }
          >
            {choice === "accept" ? __t("applicationDecisionPanel_draftAcceptanceOrder") : __t("applicationDecisionPanel_draftRejectionOrder")}
          </Button>
        );
      } else if (choice === "move") {
        const moveOn = dayOfDate(panel.relist);
        primary = (
          <Button
            type="button"
            className="w-full"
            disabled={!moveOn || moveOn <= on}
            onClick={() =>
              order({
                title: __t("applicationDecisionPanel_moveTheDate"),
                text: `${named} is to be decided on ${formatCaseDate(moveOn)}.`,
                answers: { decided: "no", responseNeeded: "no", bringForwardOn: moveOn },
              })
            }
          >
            {moveOn ? __t("applicationDecisionPanel_moveToValue0", {value0: String(shortDate(moveOn))}) : __t("applicationDecisionPanel_moveTheDate")}
          </Button>
        );
      } else if (choice === "list") {
        const listedOn = dayOfDate(panel.date);
        primary = (
          <Button
            type="button"
            className="w-full"
            disabled={!listedOn || listedOn <= on}
            onClick={() =>
              order({
                title: __t("applicationDecisionPanel_listForADate"),
                text: listingWords(listedOn, panel.invite, `${named} is not taken up today.`),
                answers: listed(listedOn, panel.invite),
              })
            }
          >
            {listedOn ? __t("applicationDecisionPanel_listOnValue0", {value0: String(shortDate(listedOn))}) : __t("applicationDecisionPanel_listForADate")}
          </Button>
        );
      }
      footer = (
        <>
          {primary}
          {differentOrder}
        </>
      );
    }
  }

  return (
    <aside
      aria-label={__t("applicationDecisionPanel_actionOnTheApplication")}
      className="flex min-h-0 flex-col border-t border-hairline bg-card lg:border-t-0 lg:border-l"
    >
      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-6">
        {__t(body)}
        {error ? <Banner variant="error">{__t(error)}</Banner> : null}
      </div>
      {footer ? (
        <div className="flex shrink-0 flex-col gap-2 border-t border-hairline px-6 py-4">
          {footer}
        </div>
      ) : null}
      {record ? (
        <ApplicationQuickOrder
          application={app}
          record={record}
          request={quick}
          canSign={canSignOrder(seat)}
          on={on}
          hearing={hearing}
          view={view}
          onOpenChange={(open) => {
            if (!open) setQuick(null);
          }}
          onDone={(message) => {
            setQuick(null);
            onDone(message);
          }}
        />
      ) : null}
    </aside>
  );
}

/** The panel's one choice, as the DS segmented control, the full width of the panel. */
function Choices({
  value,
  choices,
  onChange,
}: {
  value: Choice | null;
  choices: Choice[];
  onChange: (choice: Choice) => void;
}) {
  const __t = __useTranslations();
  return (
    <SegmentedControl
      type="single"
      size="compact"
      value={value ?? ""}
      onValueChange={(next) => {
        if (next) onChange(next as Choice);
      }}
      aria-label={__t("applicationDecisionPanel_actionOnTheApplication")}
      className="w-full [&>*]:flex-1 [&>*>span]:w-full"
    >
      {choices.map((choice) => (
        <SegmentedControlItem key={choice} value={choice} className="flex-1">
          {CHOICE_LABEL[choice]}
        </SegmentedControlItem>
      ))}
    </SegmentedControl>
  );
}

function PanelHeading({ title, lead }: { title: string; lead?: React.ReactNode }) {
  const __t = __useTranslations();
  return (
    <div className="flex flex-col gap-1">
      {/* A 40px band, so the panel's first line sits level with the title and the back
          link in the columns beside it. */}
      <h2 className="flex min-h-10 items-center text-body font-semibold">{__t(title)}</h2>
      {lead ? <p className="text-body-compact text-muted-foreground">{lead}</p> : null}
    </div>
  );
}

/** A date for the listing, and whether the other party is asked to object. */
function ListingFields({
  idPrefix,
  date,
  invite,
  hearing,
  on,
  onDate,
  onInvite,
}: {
  idPrefix: string;
  date: Date | undefined;
  invite: boolean;
  hearing: { day: string | undefined };
  on: string;
  onDate: (date: Date | undefined) => void;
  onInvite: (invite: boolean) => void;
}) {
  const __t = __useTranslations();
  const day = dayOfDate(date);
  return (
    <>
      <ListingDateField
        id={`${idPrefix}-date`}
        label={__t("applicationDecisionPanel_listingDate")}
        value={date}
        on={on}
        hearing={hearing}
        onChange={onDate}
      />
      {/* The objection is a question of its own, not a tick-box under the date (owner,
          2026-10-08): a well, with the question, its answer and what follows from it. */}
      <div className="rounded-lg border border-hairline bg-surface-sunken p-4">
        <Field>
          <FieldLabel id={`${idPrefix}-objection`}>
            {<__LocalizedText id="applicationDecisionPanel_callForObjections" />}{" "}</FieldLabel>
          <SegmentedControl
            type="single"
            size="compact"
            value={invite ? "yes" : "no"}
            onValueChange={(value) => {
              if (value) onInvite(value === "yes");
            }}
            aria-labelledby={`${idPrefix}-objection`}
            aria-describedby={`${idPrefix}-objection-note`}
            className="w-full [&>*]:flex-1 [&>*>span]:w-full"
          >
            <SegmentedControlItem value="yes" className="flex-1">
              {<__LocalizedText id="applicationDecisionPanel_yes" />}{" "}</SegmentedControlItem>
            <SegmentedControlItem value="no" className="flex-1">
              {<__LocalizedText id="applicationDecisionPanel_no" />}{" "}</SegmentedControlItem>
          </SegmentedControl>
          <FieldDescription id={`${idPrefix}-objection-note`}>
            {invite
              ? day
                ? __t("applicationDecisionPanel_theOppositePartyMayFileObjectionsBy", {value0: String(formatCaseDate(objectionDeadline(day)))})
                : __t("applicationDecisionPanel_objectionsIfAnyToBeFiledBy")
              : __t("applicationDecisionPanel_objectionsAreNotCalledForTheOpposite")}
          </FieldDescription>
        </Field>
      </div>
    </>
  );
}

/** An order's opening words: the one awaiting signature, or the one that closed it. */
function OrderCard({ text }: { text: string }) {
  const __t = __useTranslations();
  return (
    <section className="flex flex-col gap-2 rounded-lg border border-hairline bg-surface-sunken p-4">
      <h3 className="text-body-compact font-medium">{<__LocalizedText id="applicationDecisionPanel_order" />}</h3>
      <p className="line-clamp-4 text-body-compact">{__t(text)}</p>
    </section>
  );
}

function ClosedRecord({ app }: { app: LifecycleApplication }) {
  const __t = __useTranslations();
  return (
    <>
      <PanelHeading
        title={
          app.linkedOrder
            ? `${app.status === "accepted" ? __t("applicationDecisionPanel_accepted_ac3df38a") : app.status === "rejected" ? __t("applicationDecisionPanel_rejected_5036f47e") : __t("applicationDecisionPanel_dismissed_2276b0d3")} on ${formatCaseDate(app.linkedOrder.signedOn)}`
            : __t("applicationDecisionPanel_closed")
        }
        lead={
          app.linkedOrder
            ? `Order ${app.linkedOrder.id}${app.workflowResult ? ` · ${app.workflowResult}` : ""}`
            : undefined
        }
      />
      {app.linkedOrder ? <OrderCard text={app.linkedOrder.text} /> : null}
      <section className="flex flex-col gap-4">
        <h3 className="text-body font-semibold">{<__LocalizedText id="applicationDecisionPanel_history" />}</h3>
        <ol className="flex flex-col gap-2">
          {app.history.map((event, index) => (
            <li key={index} className="grid grid-cols-[6rem_1fr] gap-3 text-body-compact">
              <span className="tabular-nums text-muted-foreground">
                {shortDate(event.on)}
              </span>
              <span>{__t(event.text)}</span>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
