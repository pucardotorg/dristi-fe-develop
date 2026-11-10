"use client";
import {useTranslations as __useTranslations} from "@/i18n/use-translations";
import {LocalizedText as __LocalizedText} from "@/components/localized-text";

/**
 * Pay — the fee, why it is owed, who may pay it, and a sandbox gateway, as an act-modal
 * body. A signatory pays (with a confirmation before money would move); anyone else on
 * the case prepares the payment and marks it ready. Success closes the task by event
 * with a receipt; a pending gateway parks it in Waiting; a failure keeps the task where
 * it was, with the cue, and the person stays in the modal with the notice focused.
 */

import * as React from "react";
import { CircleCheckIcon } from "lucide-react";

import { ChromeAlertDialogContent } from "@/components/chrome/app-chrome";

import { dateTime, dueCueOf, longDate, rupees } from "@/lib/tasks/format";
import { signatoriesOf, TERMINAL } from "@/lib/tasks/permissions";
import { confirmPayment, recordPayment } from "@/lib/tasks/transitions";
import type { PaymentResult } from "@/lib/tasks/types";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DescriptionDetails,
  DescriptionList,
  DescriptionRow,
  DescriptionTerm,
} from "@/components/ui/description-list";
import { Field, FieldLabel } from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { SectionNotice } from "@/components/shell/notices";
import { useTaskActions } from "@/components/tasks/use-task-actions";
import {
  type ActContext,
  closedTitle,
  PrepareCard,
  PreparedNote,
  RailCard,
  RecordCard,
  signatoryLine,
} from "@/components/tasks/act/shared";
import { Identifier } from "@/components/chrome/identifier";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  const __t = __useTranslations();
  return (
    <DescriptionRow className="border-hairline">
      <DescriptionTerm className="text-body-compact">{__t(label)}</DescriptionTerm>
      <DescriptionDetails className="text-body-compact">
        {children}
      </DescriptionDetails>
    </DescriptionRow>
  );
}

const OUTCOMES: { value: PaymentResult; label: string; hint: string }[] = [
  { value: "success", label: "Success", hint: "Receipt issued, task closes" },
  { value: "pending", label: "Confirming", hint: "Gateway still confirming — task waits" },
  { value: "failed", label: "Failed", hint: "Nothing paid — task stays where it is" },
];

/** The signatory's pay rail: pick the sandbox outcome, confirm, pay. */
function PayCard({ ctx }: { ctx: ActContext }) {
  const __t = __useTranslations();
  const { task, kase, online, finish } = ctx;
  const { act, busy } = useTaskActions();
  const [outcome, setOutcome] = React.useState<PaymentResult>("success");
  const [confirm, setConfirm] = React.useState(false);
  // Set when the attempt just made failed: the notice announces and takes focus, and the
  // person stays here with the Pay button — a failure is not a reason to leave.
  const [justFailed, setJustFailed] = React.useState(false);
  const failedRef = React.useRef<HTMLDivElement>(null);
  const amount = task.amountPaise !== undefined ? rupees(task.amountPaise) : "the fee";

  const pay = async () => {
    setConfirm(false);
    const t = await act(task.id, (x, c) => recordPayment(x, c, outcome));
    if (!t) return;
    if (outcome === "failed") {
      setJustFailed(true);
      return;
    }
    finish(
      outcome === "success"
        ? `Paid ${amount} — receipt ${t.completion?.receipt ?? ""}`
        : "Payment made — the gateway is confirming"
    );
  };

  React.useEffect(() => {
    if (!justFailed) return;
    const id = window.requestAnimationFrame(() => failedRef.current?.focus());
    return () => window.cancelAnimationFrame(id);
  }, [justFailed, task.lastPayment?.at]);

  return (
    <RailCard title={__t("payPage_pay")} description={signatoryLine(ctx, "Paying")}>
      <PreparedNote ctx={ctx} />
      {task.lastPayment?.result === "failed" ? (
        <div ref={failedRef} tabIndex={-1} className="rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <SectionNotice
            variant="destructive"
            announce={justFailed ? "assertive" : "none"}
            title={__t("payPage_lastAttemptFailed")}
          >
            {/* The notice announces itself on failure, so the reference takes the
                face without a control whose name would be read into the alert. */}
            {<__LocalizedText id="payPage_ref" />}{" "}
            <Identifier
              value={task.lastPayment.ref}
              label={__t("payPage_paymentReference")}
              copyable={false}
            />{" "}
            {<__LocalizedText id="payPage_on" />}{" "}{dateTime(task.lastPayment.at)}{<__LocalizedText id="payPage_nothingWasPaidTryAgain" />}{" "}</SectionNotice>
        </div>
      ) : null}
      <Field>
        <FieldLabel>{<__LocalizedText id="payPage_sandboxGatewayResult" />}</FieldLabel>
        <RadioGroup value={outcome} onValueChange={(v) => setOutcome(v as PaymentResult)} className="gap-1">
          {OUTCOMES.map((o) => (
            <label
              key={o.value}
              className="flex cursor-pointer items-start gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-accent has-data-checked:bg-card"
            >
              <RadioGroupItem value={o.value} id={`outcome-${o.value}`} className="mt-0.5" />
              <span className="flex flex-col">
                <span className="text-body-compact font-medium">{__t(o.label)}</span>
                <span className="text-caption text-muted-foreground">{__t(o.hint)}</span>
              </span>
            </label>
          ))}
        </RadioGroup>
      </Field>
      <div className="flex flex-col gap-2">
        <Button
          size="lg"
          disabled={!online || !!busy || task.amountPaise === undefined}
          onClick={() => setConfirm(true)}
        >
          {<__LocalizedText id="payPage_pay" />}{task.amountPaise !== undefined ? ` ${rupees(task.amountPaise)}` : ""}
        </Button>
        <p className="text-caption text-muted-foreground">
          {task.amountPaise === undefined
            ? __t("payPage_amountToBeFetchedTheFeeIs")
            : __t("payPage_sandboxPaymentNoMoneyMoves")}
        </p>
      </div>

      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <ChromeAlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{<__LocalizedText id="payPage_pay" />}{" "}{amount}?</AlertDialogTitle>
            <AlertDialogDescription>
              {task.feeHead ?? __t("payPage_courtFee")} · {kase.parties}
              {kase.stNumber ? (
                <>
                  <span aria-hidden> · </span>
                  {/* No copy control inside the prompt's accessible description. */}
                  <Identifier value={kase.stNumber} label={__t("payPage_caseNumber")} copyable={false} />
                </>
              ) : null}
              {<__LocalizedText id="payPage_inTheLiveServiceThisGoesTo" />}{" "}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{<__LocalizedText id="payPage_cancel" />}</AlertDialogCancel>
            <AlertDialogAction onClick={() => void pay()}>{<__LocalizedText id="payPage_pay" />}{" "}{amount}</AlertDialogAction>
          </AlertDialogFooter>
        </ChromeAlertDialogContent>
      </AlertDialog>
    </RailCard>
  );
}

function ConfirmingCard({ ctx }: { ctx: ActContext }) {
  const __t = __useTranslations();
  const { task, online, finish } = ctx;
  const { act, busy } = useTaskActions();
  return (
    <RailCard
      title={__t("payPage_paymentConfirming")}
      description={__t("payPage_paidValue0TheGatewayHasNotConfirmed", {value0: String(task.lastPayment ? `on ${dateTime(task.lastPayment.at)}` : ""), value1: String(task.lastPayment?.ref ?? "—")})}
    >
      <Button
        variant="outline"
        disabled={!online || !!busy}
        onClick={async () => {
          const t = await act(task.id, confirmPayment);
          if (t) finish(`Payment confirmed — receipt ${t.completion?.receipt ?? ""}`);
        }}
      >
        {<__LocalizedText id="payPage_gatewayConfirm" />}{" "}</Button>
      <p className="text-caption text-muted-foreground">{<__LocalizedText id="payPage_sandboxStandsInForTheGatewayS" />}</p>
    </RailCard>
  );
}

/** The pay flow inside the act modal: the fee summary, then the one action region. */
export function PayBody({ ctx }: { ctx: ActContext }) {
  const __t = __useTranslations();
  const { task, kase, people, signatory } = ctx;
  const payers = signatoriesOf(kase, people);
  const due = dueCueOf(task);

  let rail: React.ReactNode;
  if (TERMINAL.has(task.status)) rail = <RecordCard ctx={ctx} title={closedTitle(task, "Paid")} />;
  else if (task.status === "payment-confirming") rail = <ConfirmingCard ctx={ctx} />;
  else if (signatory) rail = <PayCard ctx={ctx} />;
  else rail = <PrepareCard ctx={ctx} what="pay" />;

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <section className="flex flex-col gap-2">
        <h3 className="text-body font-semibold">{<__LocalizedText id="payPage_whatIsOwed" />}</h3>
        <DescriptionList>
          <Row label={__t("payPage_amount")}>
            <span className="text-title-s font-semibold tabular-nums">
              {task.amountPaise !== undefined ? rupees(task.amountPaise) : __t("payPage_toBeFetched")}
            </span>
          </Row>
          <Row label={__t("payPage_feeHead")}>{task.feeHead ?? "—"}</Row>
          <Row label={__t("payPage_for")}>{task.whatToDo}</Row>
          <Row label={__t("payPage_why")}>
            {task.why.event}
            {/dated|on \d/.test(task.why.event) ? null : (
              <span className="text-muted-foreground"> · {longDate(task.why.at)}</span>
            )}
          </Row>
          <Row label={__t("payPage_due")}>
            {due.primary === "No date" ? (
              <span className="text-muted-foreground">{<__LocalizedText id="payPage_noDateSet" />}</span>
            ) : (
              <>
                <span className={cn("tabular-nums", due.overdue && "font-medium text-destructive-ink")}>
                  {due.primary}
                </span>
                {due.date ? <span className="tabular-nums text-muted-foreground"> · {due.date}</span> : null}
              </>
            )}
            {task.deadlineNote ? (
              <span className="block text-caption text-muted-foreground">{task.deadlineNote}</span>
            ) : null}
          </Row>
          <Row label={__t("payPage_payer")}>
            {payers.map((p) => p.name).join(" or ") || __t("payPage_aSignatory")}
            {signatory ? <span className="text-muted-foreground"> {<__LocalizedText id="payPage_you" />}</span> : null}
          </Row>
          {task.completion?.receipt ? (
            <Row label={__t("payPage_receipt")}>
              <span className="inline-flex items-center gap-1.5">
                <CircleCheckIcon aria-hidden className="size-4 text-success-ink" />
                <Identifier value={task.completion.receipt} label={__t("payPage_receipt_7106dc8a")} />
              </span>
            </Row>
          ) : null}
        </DescriptionList>
      </section>
      {rail}
    </div>
  );
}
