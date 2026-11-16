"use client";

import * as React from "react";

import { DocumentPreview } from "@/components/cases/document-preview";
import { ReviewRow } from "@/components/cases/filing-form-shared";
import { ChromeDialogContent } from "@/components/chrome/app-chrome";
import { Identifier } from "@/components/chrome/identifier";
import { useCourtText } from "@/components/court/court-provider";
import { ApplicationDecisionPanel } from "@/components/employee/application-decision-panel";
import { ApplicationFacsimile } from "@/components/employee/application-review-dialog";
import { Badge } from "@/components/ui/badge";
import { DescriptionList } from "@/components/ui/description-list";
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  SegmentedControl,
  SegmentedControlItem,
} from "@/components/ui/segmented-control";
import { Separator } from "@/components/ui/separator";
import { decodeDraft } from "@/lib/applications/form-codec";
import type { LifecycleApplication } from "@/lib/applications/lifecycle";
import { today, useLifecycleApplications } from "@/lib/applications/store";
import { formatCaseDate, partiesLabel } from "@/lib/cases/types";
import { CURRENT_STAFF } from "@/lib/employee/content";
import {
  objectionLine,
  queueOf,
  shortDate,
  statusLine,
} from "@/lib/employee/application-queue";
import {
  caseOf,
  causeTitleOf,
  courtDocumentOf,
  nextHearingOf,
} from "@/lib/employee/application-tasks";
import { useTranslations } from "next-intl";
import { translateText } from "@/i18n/translate-text";
import type { MessageKey } from "@/i18n/messages";

const QUEUE_LABEL: Record<string, MessageKey> = {
  onboard: "applicationDialog_toOnboard",
  decide: "applicationDialog_toDecide",
  signing: "applicationDialog_orderAwaitingSignature",
  later: "applicationDialog_upcoming",
  closed: "applicationDialog_closed",
  archive: "applicationDialog_archive",
};

/**
 * One application, opened from the Applications list as a pop-up (owner, 2026-10-21: the
 * list beside the application "is actually a distraction … make this a pop-up like it was
 * before").
 *
 * The left holds the facts and what can be done; the right is the paper. Once the
 * application has been onboarded, the papers linked to it — **the order(s) already passed
 * on it** and **the objection** from the other side — are read in the same place, a switch
 * above the paper, so they are read in the application's context rather than looked up.
 *
 * **Every act is an order** (owner, 2026-10-21). Onboarding, when it will be decided and
 * whether objections are called for are not a system action here any more: *Pass an
 * order* opens the order screen, where they are the Application item of the order's data
 * (`application-outcome.ts`). The application moves once that order is signed and its
 * data complete (`application-outcome-steps.ts`).
 */
export function ApplicationDialog({
  applicationId,
  view,
  onOpenChange,
  onReturnFocus,
  onDone,
}: {
  /** An order passed from the quick order on this application: move on to the next. */
  onDone: (applicationId: string, message: string) => void;
  applicationId: string | null;
  /** The list it was opened from, carried to the order screen for the way back. */
  view: string;
  onOpenChange: (open: boolean) => void;
  onReturnFocus: () => void;
}) {
  const apps = useLifecycleApplications();
  const app = applicationId
    ? apps.find((item) => item.id === applicationId)
    : undefined;
  return (
    <Dialog open={Boolean(app)} onOpenChange={onOpenChange}>
      {app ? (
        <ApplicationDialogBody
          key={app.id}
          app={app}
          all={apps}
          view={view}
          onReturnFocus={onReturnFocus}
          onDone={onDone}
        />
      ) : null}
    </Dialog>
  );
}

type Paper = {
  id: string;
  /** The switch's word for it. */
  label: string;
  /** The preview's title. */
  title: string;
  content: React.ReactNode;
};

function ApplicationDialogBody({
  app,
  all,
  view,
  onReturnFocus,
  onDone,
}: {
  app: LifecycleApplication;
  all: LifecycleApplication[];
  view: string;
  onReturnFocus: () => void;
  onDone: (applicationId: string, message: string) => void;
}) {
  const t = useTranslations();
  const courtText = useCourtText();
  const on = today();
  const record = caseOf(app);
  const document = React.useMemo(() => courtDocumentOf(app), [app]);
  const objection = app.objectionId
    ? all.find((item) => item.id === app.objectionId)
    : undefined;

  /* The application first, then what is linked to it: its objection, and the orders
     passed on it, latest last — the order the case file reads them in. */
  const papers = React.useMemo<Paper[]>(() => {
    const list: Paper[] = [];
    list.push({
      id: "application",
      label: "Application",
      title: document?.title ?? app.typeLabel,
      content: document ? (
        <ApplicationFacsimile document={document} />
      ) : (
        <p className="p-6 text-body text-muted-foreground">
          {t("applicationDialog_theApplicationsTextCouldNotBe")}
        </p>
      ),
    });
    if (objection) {
      const objectionDocument = courtDocumentOf(objection);
      list.push({
        id: "objection",
        label: "Objection",
        title: `Objection from the ${objection.side}`,
        content:
          objectionDocument && objectionDocument.paragraphs.length > 0 ? (
            <ApplicationFacsimile document={objectionDocument} />
          ) : (
            <ObjectionPaper objection={objection} court={courtText(t("applicationDialog_beforeTheCourt", { court: CURRENT_STAFF.court }))} />
          ),
      });
    }
    /* Once onboarded the other side may object, so the objection always has its place —
       saying where it stands when there is none to read (owner, 2026-10-22). */
    if (!objection && app.onboardedOn) {
      list.push({
        id: "objection",
        label: "Objection",
        title: "Objection",
        content: <NoObjection app={app} on={on} />,
      });
    }
    const passed = app.orders ?? [];
    passed.forEach((order, index) => {
      list.push({
        id: `order-${order.key}`,
        label:
          passed.length === 1
            ? "Previous order"
            : `Order ${index + 1} · ${shortDate(order.signedOn)}`,
        title: `Order ${order.id}`,
        content: (
          <OrderPaper
            court={courtText(t("applicationDialog_beforeTheCourt", { court: CURRENT_STAFF.court }))}
            caseNumber={record?.caseNumber}
            matter={record ? partiesLabel(record) : causeTitleOf(app)}
            id={order.id}
            title={translateText(t, order.title)}
            text={order.text}
            signedOn={order.signedOn}
          />
        ),
      });
    });
    /* An order signed before orders were recorded on the application: the one that
       closed it. */
    if (passed.length === 0 && app.linkedOrder) {
      const order = app.linkedOrder;
      list.push({
        id: "order-linked",
        label: "Previous order",
        title: `Order ${order.id}`,
        content: (
          <OrderPaper
            court={courtText(t("applicationDialog_beforeTheCourt", { court: CURRENT_STAFF.court }))}
            caseNumber={record?.caseNumber}
            matter={record ? partiesLabel(record) : causeTitleOf(app)}
            id={order.id}
            text={order.text}
            signedOn={order.signedOn}
          />
        ),
      });
    }
    return list;
  }, [app, document, objection, record, courtText, on, t]);
  const [paperId, setPaperId] = React.useState("application");
  const paper = papers.find((item) => item.id === paperId) ?? papers[0];

  return (
    <ChromeDialogContent
      className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl md:h-[90dvh] xl:max-w-7xl"
      onCloseAutoFocus={(event) => {
        event.preventDefault();
        onReturnFocus();
      }}
    >
      <DialogHeader className="shrink-0 gap-2 p-6 pr-16">
        <div className="flex flex-wrap items-center gap-2">
          <DialogTitle className="text-title-s font-semibold">{app.typeLabel}</DialogTitle>
          <StageBadge app={app} on={on} />
        </div>
        <DialogDescription className="text-body-compact text-muted-foreground">
          {causeTitleOf(app)}
          {record ? (
            <>
              {" · "}
              <Identifier value={record.caseNumber} label={t("applicationDialog_caseNumber")} />
            </>
          ) : null}
        </DialogDescription>
      </DialogHeader>
      <Separator />

      {/* As the workstation on main had it, less its list (owner, 2026-10-21): the
          application in the middle, the action panel beside it. */}
      <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_20rem] lg:grid-rows-[minmax(0,1fr)] lg:overflow-hidden xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-4 p-6 lg:min-h-0 lg:overflow-y-auto [&>*]:shrink-0">
          <div className="rounded-lg bg-surface-sunken p-4">
            <DescriptionList>
              <Facts app={app} on={on} />
            </DescriptionList>
          </div>
          {/* The linked papers, read in place of the application (owner, 2026-10-21). */}
          {papers.length > 1 ? (
            <SegmentedControl
              type="single"
              size="compact"
              value={paper.id}
              onValueChange={(next) => {
                if (next) setPaperId(next);
              }}
              aria-label={t("applicationDialog_whichPaperToRead")}
              className="w-full overflow-x-auto sm:w-fit"
            >
              {papers.map((item) => (
                <SegmentedControlItem key={item.id} value={item.id}>
                  {item.label}
                </SegmentedControlItem>
              ))}
            </SegmentedControl>
          ) : null}
          <DocumentPreview
            key={paper.id}
            variant="quiet"
            surface="card"
            height="auto"
            title={paper.title}
            source={{ kind: "composed", content: paper.content }}
          />
        </div>

        {/* Keyed by application: a half-made choice never carries onto the next one. */}
        <ApplicationDecisionPanel
          key={app.id}
          app={app}
          on={on}
          view={view}
          onDone={(message) => onDone(app.id, message)}
        />
      </div>
    </ChromeDialogContent>
  );
}


function StageBadge({ app, on }: { app: LifecycleApplication; on: string }) {
  const t = useTranslations();
  const queue = queueOf(app, on);
  if (queue === "closed" || queue === "archive") {
    return (
      <Badge
        variant={
          app.status === "accepted"
            ? "success"
            : app.status === "rejected" || app.status === "dismissed"
              ? "destructive"
              : "secondary"
        }
      >
        {app.decisionLabel || statusLine(app, on).word}
      </Badge>
    );
  }
  return <Badge variant="info">{t(QUEUE_LABEL[queue ?? "all"]) ?? t("applicationDialog_open")}</Badge>;
}

/**
 * The facts a bench checks first, always the same ones: when it is due, the objection,
 * the next hearing, its number, and who filed it when.
 */
function Facts({ app, on }: { app: LifecycleApplication; on: string }) {
  const t = useTranslations();
  const queue = queueOf(app, on);
  const closed = queue === "closed" || queue === "archive";
  const line = statusLine(app, on);
  const hearing = nextHearingOf(app, on);
  const number = app.applicationNumber ?? app.temporaryId;
  const due = closed
    ? (app.decisionLabel ?? line.word)
    : app.review
      ? t("applicationDialog_reviewByShortDate", { shortDate: shortDate(app.review.dueOn) })
      : app.decide
        ? t("applicationDialog_listedForShortDate", { shortDate: shortDate(app.decide.dueOn) })
        : "—";
  return (
    <>
      <ReviewRow term={closed ? t("applicationDialog_outcome") : t("applicationDialog_due")}>
        <span className="flex flex-wrap items-center gap-2">
          {due}
          {!closed && line.due === "overdue" ? <Badge variant="destructive">{t("applicationDialog_overdue")}</Badge> : null}
          {!closed && line.due === "today" ? <Badge variant="warning">{t("applicationDialog_dueToday")}</Badge> : null}
        </span>
      </ReviewRow>
      <ReviewRow term={t("applicationDialog_objection")}>{objectionLine(app, on)}</ReviewRow>
      <ReviewRow term={t("applicationDialog_nextHearing")}>{hearing ? shortDate(hearing) : t("applicationDialog_noneListed")}</ReviewRow>
      <ReviewRow term={app.applicationNumber ? t("applicationDialog_applicationNo") : t("applicationDialog_temporaryNo")}>
        {number ? (
          <Identifier
            value={number}
            label={app.applicationNumber ? t("applicationDialog_applicationNumber") : t("applicationDialog_temporaryNumber")}
          />
        ) : (
          "—"
        )}
      </ReviewRow>
      <ReviewRow term={t("applicationDialog_filed")}>
        {t("applicationDialog_formatCaseDateByValueFor", { formatCaseDate: formatCaseDate(app.submittedOn ?? app.createdOn), value: app.raisedBy ?? app.createdByName, side: app.side })}
      </ReviewRow>
    </>
  );
}


/** An order passed on the application, set as paper, as the application is. */
function OrderPaper({
  court,
  caseNumber,
  matter,
  id,
  title,
  text,
  signedOn,
}: {
  court: string;
  caseNumber?: string;
  matter: string;
  id: string;
  title?: string;
  text: string;
  signedOn: string;
}) {
  const t = useTranslations();
  return (
    <article className="flex flex-col gap-6 rounded-md bg-paper p-6 text-paper-foreground">
      <header className="flex flex-col gap-2 text-center">
        <p className="text-body font-semibold">{court}</p>
        {caseNumber ? <p className="text-body font-semibold">{t("applicationDialog_caseNoCaseNumber", { caseNumber })}</p> : null}
        <p className="text-body font-semibold">{matter}</p>
        <p className="text-body-compact text-paper-muted-foreground">
          {t("applicationDialog_orderIdFormatCaseDate", { id, formatCaseDate: formatCaseDate(signedOn) })}
        </p>
      </header>
      {title ? <h3 className="text-center text-body font-semibold">{title}</h3> : null}
      <p className="text-body whitespace-pre-wrap">
        {text.trim() || t("applicationDialog_theOrdersWordsWereNotRecorded")}
      </p>
      <footer className="flex flex-col items-end gap-2">
        <p className="text-body-compact text-paper-muted-foreground">
          {t("applicationDialog_signedByTheJudicialMagistrateOf", { formatCaseDate: formatCaseDate(signedOn) })}
        </p>
      </footer>
    </article>
  );
}

/** An objection whose filing carries only its grounds. */
function ObjectionPaper({
  objection,
  court,
}: {
  objection: LifecycleApplication;
  court: string;
}) {
  const t = useTranslations();
  const reason = decodeDraft(objection.form).applicationDetails.text.trim();
  return (
    <article className="flex flex-col gap-6 rounded-md bg-paper p-6 text-paper-foreground">
      <header className="flex flex-col gap-2 text-center">
        <p className="text-body font-semibold">{court}</p>
        <p className="text-body font-semibold">{causeTitleOf(objection)}</p>
        <p className="text-body-compact text-paper-muted-foreground">
          {t("applicationDialog_receivedFormatCaseDate", { formatCaseDate: formatCaseDate(objection.submittedOn ?? objection.createdOn) })}
        </p>
      </header>
      <h3 className="text-center text-body font-semibold">
        {t("applicationDialog_objectionOnBehalfOfTheSide", { side: objection.side })}
      </h3>
      <p className="text-body whitespace-pre-wrap">{reason || t("applicationDialog_noGroundsWereEntered")}</p>
      <footer className="flex flex-col items-end gap-2">
        <p className="text-body-compact text-paper-muted-foreground">
          {t("applicationDialog_filedByValue", { value: objection.raisedBy ?? objection.createdByName })}
        </p>
      </footer>
    </article>
  );
}

/** The Objection tab when there is no objection to read: why, in a line. */
function NoObjection({ app, on }: { app: LifecycleApplication; on: string }) {
  const t = useTranslations();
  const other = app.side === "complainant" ? "accused" : "complainant";
  const text = !app.objectionsInvited
    ? t("applicationDialog_objectionsWereNotCalledForThe", { other })
    : app.objectionDueBy && app.objectionDueBy >= on
      ? t("applicationDialog_noObjectionYetTheOtherMay", { other, formatCaseDate: formatCaseDate(app.objectionDueBy) })
      : `No objection was received from the ${other}${
          app.objectionDueBy ? ` by ${formatCaseDate(app.objectionDueBy)}` : ""
        }.`;
  return <p className="p-6 text-body text-muted-foreground">{text}</p>;
}
