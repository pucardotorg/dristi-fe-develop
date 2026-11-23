"use client";

/**
 * Preview — everything the filing contains, twice over.
 *
 * "Synopsis" is the readable summary, one card per section, each with a Review control
 * that takes you to that section to change it. "Court document" is the same filing as the
 * court will receive it (shared with Sign — see ./preview/court-document).
 */

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  PencilLineIcon,
  PrinterIcon,
  TriangleAlertIcon,
} from "lucide-react";

import { joinDot } from "@/lib/filing/format";
import { CASE_TYPE, COURT } from "@/lib/filing/options";
import { useProfile } from "@/lib/filing/profile";
import { sectionComplete, signatories } from "@/lib/filing/selectors";
import { getCaseFilingRepository } from "@/lib/filing/data";
import { caseFilingErrorMessage } from "@/lib/filing/data/cases-api";
import { getStep, neighbours, type StepId } from "@/lib/filing/steps";
import { useFiling } from "@/lib/filing/store";
import type { FilingDraft } from "@/lib/filing/types";
import {
  participantSteps,
  stepForValidationField,
  type ValidationError,
} from "@/lib/filing/validation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DescriptionDetails,
  DescriptionList,
  DescriptionRow,
  DescriptionTerm,
} from "@/components/ui/description-list";
import { Checkbox } from "@/components/ui/checkbox";
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Dialog } from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ChromeDialogContent } from "@/components/chrome/app-chrome";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FilingFooter } from "@/components/filing/filing-footer";
import { FilingPageHeader } from "@/components/filing/filing-page-header";
import { FilingMain } from "@/components/filing/filing-shell";
import { FormCard } from "@/components/filing/form-card";
import { SectionNotice } from "@/components/filing/notices";
import { CourtDocument } from "@/components/filing/sections/preview/court-document";
import {
  INTERIM_RELIEF_SUMMARY,
  NOT_PROVIDED,
  accusedSummaries,
  adrLabel,
  advocateSummaries,
  amountClaimedText,
  chequeSummaries,
  complainantSummary,
  documentSummary,
  finalReliefSummary,
  jurisdictionSummary,
  noticeSummary,
  totalChequeText,
  witnessSummaries,
} from "@/components/filing/sections/preview/derive";
import { useCourtText } from "@/components/court/court-provider";
import { useTranslations } from "next-intl";
import { translateText } from "@/i18n/translate-text";

/* ───────────────────────────── Key-value rows ──────────────────────── */

type Row = { term: string; value: React.ReactNode };

function KeyValues({ rows }: { rows: Row[] }) {
  return (
    <DescriptionList>
      {rows.map((r, i) => (
        /* Phone: the label over its value, the way every fact on a phone card reads in
           this product. Side by side, a 7rem label column left an address five lines
           of a 150px column. From `sm` up the two columns stand as designed. */
        <DescriptionRow
          key={`${r.term}-${i}`}
          className="max-sm:grid-cols-1 max-sm:gap-0.5 max-sm:border-hairline max-sm:py-2.5"
        >
          <DescriptionTerm className="text-body-compact text-muted-foreground max-sm:text-caption">
            {r.term}
          </DescriptionTerm>
          <DescriptionDetails className="text-body-compact font-medium text-foreground tabular-nums">
            {r.value}
          </DescriptionDetails>
        </DescriptionRow>
      ))}
    </DescriptionList>
  );
}

/** A named sub-record inside a card — "Advocate 1", "Cheque 2". */
function SubBlock({ title, rows }: { title: string; rows: Row[] }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-caption font-medium text-muted-foreground">{title}</p>
      <KeyValues rows={rows} />
    </div>
  );
}

/** Opens the read-only panel for a section. Changing anything happens in the section. */
function ReviewButton({ section, onClick }: { section: string; onClick: () => void }) {
  const t = useTranslations();
  return (
    <>
      <Button type="button" variant="outline" onClick={onClick} className="max-sm:hidden">
        <PencilLineIcon data-icon="inline-start" aria-hidden />
        {t.rich("previewSection_reviewSection", {
          section,
          span: (chunks) => <span className="sr-only">{chunks}</span>,
        })}
      </Button>
      {/* Phone: the DS small button, so a long section title keeps its line. */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onClick}
        className="h-10 sm:hidden"
      >
        <PencilLineIcon data-icon="inline-start" aria-hidden />
        {t.rich("previewSection_reviewSection", {
          section,
          span: (chunks) => <span className="sr-only">{chunks}</span>,
        })}
      </Button>
    </>
  );
}

/**
 * Whether a section has everything the court needs, said once per card. Only the
 * unfinished ones take colour — nine green ticks would drown the one status that matters.
 */
function SectionState({ complete }: { complete: boolean }) {
  const t = useTranslations();
  return complete ? (
    <span className="flex items-center gap-1 text-caption font-medium text-muted-foreground">
      <CheckIcon className="size-3.5" aria-hidden />
      {t("previewSection_complete")}
    </span>
  ) : (
    <span className="flex items-center gap-1 text-caption font-medium text-warning-ink">
      <TriangleAlertIcon className="size-3.5" aria-hidden />
      {t("previewSection_incomplete")}
    </span>
  );
}

/** The status marker and the Review control as one action cluster in the card header. */
function CardActions({
  complete,
  section,
  onEdit,
}: {
  complete: boolean;
  section: string;
  onEdit: () => void;
}) {
  return (
    <div className="flex items-center gap-2 sm:gap-3">
      <SectionState complete={complete} />
      <ReviewButton section={section} onClick={onEdit} />
    </div>
  );
}

/* ───────────────────────────── Edit panel data ─────────────────────── */

/**
 * "Don't ask me again" for the Review question, kept per browser rather than per draft:
 * it is a preference about how this person works, not a fact about one complaint.
 */
const SKIP_REVIEW_PROMPT = "dristi:filing:skip-review-prompt";

function skipReviewPrompt(): boolean {
  try {
    return localStorage.getItem(SKIP_REVIEW_PROMPT) === "1";
  } catch {
    return false;
  }
}

function rememberSkipReviewPrompt(): void {
  try {
    localStorage.setItem(SKIP_REVIEW_PROMPT, "1");
  } catch {
    /* private mode — the question simply gets asked again next time */
  }
}

type PanelKey =
  | "complainant"
  | "advocate"
  | "accused"
  | "cheque"
  | "demand"
  | "jurisdiction"
  | "adr"
  | "witnesses"
  | "documents";

/** A section of the filing, as this screen names it and navigates to it. */
type EditPanel = {
  title: string;
  step: StepId;
  /** What was actually entered — rows the person has not filled are left out. */
  fields: { label: string; value: string }[];
};

/** Drop the rows that would only say "Not provided" — an empty panel says that once. */
function entered(rows: { label: string; value: string }[]) {
  return rows.filter((r) => r.value.trim() && r.value !== NOT_PROVIDED);
}

/** The panel behind each card's Edit — what was entered, beside what it was read from. */
function buildPanels(draft: FilingDraft): Record<PanelKey, EditPanel> {
  const complainant = complainantSummary(draft.complainants[0]);
  const advocates = advocateSummaries(draft);
  const accused = accusedSummaries(draft);
  const cheques = chequeSummaries(draft);
  const notice = noticeSummary(draft.notices[0]);
  const jurisdiction = jurisdictionSummary(draft);
  const witnesses = witnessSummaries(draft);
  const documents = documentSummary(draft);

  return {
    complainant: {
      title: "Complainant",
      step: "complainant",
      fields: entered([
        { label: "Name", value: complainant.name },
        { label: "Type", value: complainant.type },
        { label: "CIN or PAN", value: complainant.cinPan },
        { label: "Mobile", value: complainant.mobile },
        { label: "Email", value: complainant.email },
        { label: "Present address", value: complainant.presentAddress },
        { label: "Permanent address", value: complainant.permanentAddress },
        { label: "Power of attorney", value: complainant.poa },
      ]),
    },
    advocate: {
      title: "Advocates",
      step: "advocate",
      fields: entered(
        advocates.flatMap((a) => [
          { label: a.label, value: a.nameWithBar },
          { label: "Appearing for", value: a.appearingFor },
        ]),
      ),
    },
    accused: {
      title: "Accused",
      step: "accused",
      fields: entered(
        accused.flatMap((a) => [
          { label: a.label, value: joinDot(a.name, a.type) },
          { label: "Address", value: a.address },
        ]),
      ),
    },
    cheque: {
      title: "Cheque & return memo",
      step: "cheque",
      fields: entered(
        cheques.flatMap((c) => [
          { label: c.label, value: joinDot(c.amount, c.number) },
          { label: "Drawer’s bank", value: c.drawerBank },
          { label: "Returned", value: c.returned },
        ]),
      ),
    },
    demand: {
      title: "Demand notice & debt",
      step: "demand-notice",
      fields: entered([
        { label: "Nature of debt", value: notice.nature },
        { label: "Dispatched", value: notice.dispatched },
        { label: "Delivered", value: notice.delivered },
        { label: "Payment received", value: notice.payment },
        // Statutory, not entered: S-138 gives the drawer 15 days from the notice.
        { label: "Demand", value: "Pay within 15 days" },
      ]),
    },
    jurisdiction: {
      title: "Jurisdiction & limitation",
      step: "jurisdiction",
      fields: entered([
        { label: "Cheque presented by", value: jurisdiction.presentedBy },
        { label: "Bank", value: jurisdiction.bank },
        { label: "IFSC", value: jurisdiction.ifsc },
        { label: "Police station", value: jurisdiction.police },
        { label: "Cause of action", value: jurisdiction.causeDate },
        { label: "Complaint filing", value: jurisdiction.filingDate },
      ]),
    },
    adr: {
      title: "ADR, other details & prayer",
      step: "adr-prayer",
      fields: entered([
        { label: "Open to settlement (ADR)", value: adrLabel(draft) },
        { label: "Interim relief", value: INTERIM_RELIEF_SUMMARY },
        { label: "Final relief", value: finalReliefSummary(draft) },
      ]),
    },
    witnesses: {
      title: "Witnesses",
      step: "witnesses",
      fields: entered(
        witnesses.flatMap((w) => [
          { label: w.label, value: w.name },
          { label: "Will prove", value: w.prove },
        ]),
      ),
    },
    documents: {
      title: "Documents",
      step: "documents",
      fields: entered([
        {
          label: "Uploaded",
          value: documents.uploaded.length
            ? `${documents.uploaded.length} of ${documents.total} required documents attached`
            : "Nothing attached yet",
        },
        {
          label: "Pending",
          value: documents.remaining
            ? `${documents.remaining} required document${documents.remaining === 1 ? "" : "s"} still to upload`
            : "All required documents uploaded",
        },
      ]),
    },
  };
}

/* ───────────────────────────── Source files ────────────────────────── */

/* ───────────────────────────── Incomplete sections ─────────────────── */

/**
 * The count of what is left, which opens into the sections themselves. A count alone
 * says something is missing without saying where; each row here goes straight to that
 * section, without the Review question — naming the section is already the choice.
 */
function IncompleteSections({
  sections,
}: {
  sections: { key: string; title: string; href: string }[];
}) {
  const t = useTranslations();
  const count = sections.length;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" className="text-muted-foreground">
          <TriangleAlertIcon data-icon="inline-start" aria-hidden />
          {count} section{count === 1 ? "" : "s"} incomplete
          <ChevronDownIcon data-icon="inline-end" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent side="top" align="end" className="w-80 gap-2 p-2">
        <PopoverHeader className="px-2 pt-2">
          <PopoverTitle className="text-body-compact font-semibold">
            {t("previewSection_stillToComplete")}
          </PopoverTitle>
          <PopoverDescription className="text-caption">
            {t("previewSection_openASectionToFinishIt")}
          </PopoverDescription>
        </PopoverHeader>
        <ul className="flex flex-col">
          {sections.map((s) => (
            <li key={s.key}>
              <Button
                asChild
                variant="ghost"
                className="h-10 w-full justify-start gap-2 px-2 font-normal"
              >
                <Link href={s.href}>
                  <span className="min-w-0 flex-1 truncate text-left">{s.title}</span>
                  <ChevronRightIcon aria-hidden className="text-muted-foreground" />
                </Link>
              </Button>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

/* ───────────────────────────── Screen ──────────────────────────────── */

export function PreviewSection() {
  const t = useTranslations();
  const courtText = useCourtText();
  const { draft, hrefFor, steps } = useFiling();
  const { prev, next } = neighbours("preview");
  const router = useRouter();
  const [view, setView] = React.useState("synopsis");
  /** The section Review was pressed on, while the question about leaving is open. */
  const [editKey, setEditKey] = React.useState<PanelKey | null>(null);
  /** Ticked in the question itself — remembered for this browser, not this draft. */
  const [dontAsk, setDontAsk] = React.useState(false);
  /** The backend completeness check runs on "Continue to sign". */
  const [validating, setValidating] = React.useState(false);
  /** The missing items the backend reported; `null` while the dialog is closed. */
  const [problems, setProblems] = React.useState<ValidationError[] | null>(null);
  /** The check itself could not run (offline, session ended, draft expired). */
  const [validateError, setValidateError] = React.useState<string | null>(null);

  const complainant = complainantSummary(draft.complainants[0]);
  const advocates = advocateSummaries(draft);
  const accused = accusedSummaries(draft);
  const cheques = chequeSummaries(draft);
  const notice = noticeSummary(draft.notices[0]);
  const jurisdiction = jurisdictionSummary(draft);
  const witnesses = witnessSummaries(draft);
  const documents = documentSummary(draft);

  const panels = React.useMemo(() => buildPanels(draft), [draft]);
  // A per-participant validate error names its case_participant_id; the saved ids say which
  // step it belongs to (`participants.<uuid>` → complainant / accused / witness).
  const participantStepById = React.useMemo(() => participantSteps(draft), [draft]);
  const panel = editKey ? panels[editKey] : null;

  /**
   * **Review is a way out of this screen, so it says so before it takes you.**
   *
   * It used to open a read-only peek beside the document — a third place a section's
   * values could be read, which could not be edited and therefore always ended in
   * "Open full section" anyway (owner, 2026-09-24). Now it asks once, and a person who
   * does not want to be asked again says so in the question itself.
   */
  const goTo = React.useCallback(
    (key: PanelKey) => router.push(hrefFor(panels[key].step)),
    [router, hrefFor, panels],
  );

  const review = (key: PanelKey) => {
    if (skipReviewPrompt()) {
      goTo(key);
      return;
    }
    setDontAsk(false);
    setEditKey(key);
  };

  const confirmReview = () => {
    const key = editKey;
    if (dontAsk) rememberSkipReviewPrompt();
    setEditKey(null);
    if (key) goTo(key);
  };

  // Completeness per section, from the same rule the sidebar counts with.
  const done = (key: PanelKey) => sectionComplete(draft, panels[key].step);
  const readyToSign = sectionComplete(draft, "preview");
  // Signing for a complainant means recording the oath in the same step, where the state
  // asks for one (`OTH-3`), so the way there says so. Advocates never take it.
  const { profile } = useProfile();
  const yourOathAhead = signatories(draft, profile).complainants.some(
    (s) => s.you && s.oathTaken === false,
  );
  const incomplete = (Object.keys(panels) as PanelKey[]).filter((k) => !done(k));

  /** The browser's print dialog — which is also how a PDF is saved. */
  const printFile = () => {
    if (typeof window !== "undefined") window.print();
  };

  const signAhead = steps.includes("sign");
  const continueHref = next ? hrefFor(next) : undefined;

  /**
   * "Continue to sign" asks the court's server whether the filing is complete before going
   * on to sign. If it is, the filer continues; if not, the missing items are listed and they
   * stay here — the backend is the authority on completeness (not the hints above). Bulk
   * filing (no sign step here) and local-only drafts just continue.
   */
  const continueToSign = async () => {
    const caseId = draft.caseId;
    if (!signAhead || !caseId) {
      if (continueHref) router.push(continueHref);
      return;
    }
    setValidating(true);
    setValidateError(null);
    try {
      const { isValid, errors } = await getCaseFilingRepository().validateCase(caseId);
      if (isValid) {
        if (continueHref) router.push(continueHref);
        return;
      }
      setProblems(errors);
    } catch (err) {
      setValidateError(caseFilingErrorMessage(err));
    } finally {
      setValidating(false);
    }
  };

  return (
    <>
      <FilingMain>
        <FilingPageHeader
          title={t("previewSection_preview")}
          description={
            <>
              {t.rich("previewSection_checkEverythingYouHaveFiledUse", {
                strong: (chunks) => (
                  <strong className="font-semibold text-foreground">{chunks}</strong>
                ),
              })}
            </>
          }
        />

        <Tabs value={view} onValueChange={setView} className="gap-6">
          <div className="flex flex-col items-start justify-between gap-2 border-b border-hairline sm:flex-row sm:items-end">
            <TabsList
              variant="line"
              aria-label={t("previewSection_previewFormat")}
              className="order-2 sm:order-none"
            >
              <TabsTrigger value="synopsis" className="h-10 px-3">
                {t("previewSection_complaint")}
              </TabsTrigger>
              <TabsTrigger value="document" className="h-10 px-3">
                {t("previewSection_complaintPdf")}
              </TabsTrigger>
            </TabsList>
            <Button type="button" variant="outline" onClick={printFile} className="sm:mb-2">
              <PrinterIcon data-icon="inline-start" aria-hidden />
              {t("previewSection_printOrSaveAsPdf")}
            </Button>
          </div>

          {/* ── Synopsis ── */}
          <TabsContent value="synopsis" className="flex flex-col gap-6">
            {/* No status badge here: the card captions below say it per section, and the
                footer says it once for the filing. */}
            <FormCard title={t("previewSection_filingSummary")}>
              <KeyValues
                rows={[
                  { term: t("previewSection_offence"), value: CASE_TYPE.offence },
                  { term: t("previewSection_court"), value: courtText(COURT.name) },
                  {
                    term: t("previewSection_totalChequeAmount"),
                    value: totalChequeText(draft),
                  },
                  { term: t("previewSection_amountClaimed"), value: amountClaimedText(draft) },
                ]}
              />
            </FormCard>

            <FormCard
              title={t("previewSection_complainant")}
              action={
                <CardActions
                  complete={done("complainant")}
                  section="complainant"
                  onEdit={() => review("complainant")}
                />
              }
            >
              <KeyValues
                rows={[
                  { term: t("previewSection_name"), value: complainant.name },
                  { term: t("previewSection_type"), value: complainant.type },
                  ...(complainant.cinPan
                    ? [{ term: t("previewSection_cinOrPan"), value: complainant.cinPan }]
                    : []),
                  { term: t("previewSection_mobile"), value: complainant.mobile },
                  { term: t("previewSection_email"), value: complainant.email },
                  {
                    term: t("previewSection_presentAddress"),
                    value: complainant.presentAddress,
                  },
                  {
                    term: t("previewSection_permanentAddress"),
                    value: complainant.permanentAddress,
                  },
                  { term: t("previewSection_powerOfAttorney"), value: complainant.poa },
                ]}
              />
            </FormCard>

            <FormCard
              title={t("previewSection_advocates")}
              action={
                <CardActions
                  complete={done("advocate")}
                  section="advocates"
                  onEdit={() => review("advocate")}
                />
              }
            >
              {advocates.length ? (
                advocates.map((a) => (
                  <SubBlock
                    key={a.key}
                    title={a.label}
                    rows={[
                      { term: t("previewSection_name"), value: a.name },
                      { term: t("previewSection_barRegistration"), value: a.bar },
                      { term: t("previewSection_appearingFor"), value: a.appearingFor },
                    ]}
                  />
                ))
              ) : (
                <p className="text-body-compact text-muted-foreground">
                  {t("previewSection_noAdvocateAddedTheComplainantAppears")}
                </p>
              )}
            </FormCard>

            <FormCard
              title={t("previewSection_accused")}
              action={
                <CardActions
                  complete={done("accused")}
                  section="accused"
                  onEdit={() => review("accused")}
                />
              }
            >
              {accused.map((a) => (
                <SubBlock
                  key={a.key}
                  title={a.label}
                  rows={[
                    { term: t("previewSection_name"), value: a.name },
                    { term: t("previewSection_type"), value: a.type },
                    { term: t("previewSection_address"), value: a.addressWithPolice },
                  ]}
                />
              ))}
            </FormCard>

            <FormCard
              title={t("previewSection_chequeReturnMemo")}
              action={
                <CardActions
                  complete={done("cheque")}
                  section="cheque and return memo"
                  onEdit={() => review("cheque")}
                />
              }
            >
              {cheques.map((c) => (
                <SubBlock
                  key={c.key}
                  title={c.label}
                  rows={[
                    { term: t("previewSection_amount"), value: c.amount },
                    { term: t("previewSection_chequeNoDate"), value: c.numberAndDate },
                    { term: t("previewSection_drawersBank"), value: c.drawerBank },
                    { term: t("previewSection_returned"), value: c.returned },
                  ]}
                />
              ))}
            </FormCard>

            <FormCard
              title={t("previewSection_demandNoticeDebt")}
              action={
                <CardActions
                  complete={done("demand")}
                  section="demand notice and debt"
                  onEdit={() => review("demand")}
                />
              }
            >
              <KeyValues
                rows={[
                  { term: t("previewSection_natureOfDebt"), value: notice.nature },
                  { term: t("previewSection_noticeDispatched"), value: notice.dispatched },
                  { term: t("previewSection_delivered"), value: notice.delivered },
                  { term: t("previewSection_replyReceived"), value: notice.replied },
                  { term: t("previewSection_paymentReceived"), value: notice.payment },
                ]}
              />
            </FormCard>

            <FormCard
              title={t("previewSection_jurisdictionLimitation")}
              action={
                <CardActions
                  complete={done("jurisdiction")}
                  section="jurisdiction and limitation"
                  onEdit={() => review("jurisdiction")}
                />
              }
            >
              <KeyValues
                rows={[
                  {
                    term: t("previewSection_chequePresentedBy"),
                    value: jurisdiction.presentedBy,
                  },
                  { term: t("previewSection_policeStation"), value: jurisdiction.police },
                  { term: t("previewSection_causeOfAction"), value: jurisdiction.causeDate },
                  {
                    term: t("previewSection_complaintFilingDate"),
                    value: jurisdiction.filingDate,
                  },
                  {
                    term: t("previewSection_withinLimitation"),
                    value: jurisdiction.inTime ? (
                      <Badge variant="success">
                        <CheckIcon aria-hidden />
                        {t("previewSection_yesInTime")}
                      </Badge>
                    ) : (
                      <Badge variant="warning">
                        <TriangleAlertIcon aria-hidden />
                        {translateText(t, jurisdiction.delayText)}
                      </Badge>
                    ),
                  },
                ]}
              />
            </FormCard>

            <FormCard
              title={t("previewSection_adrOtherDetailsPrayer")}
              action={
                <CardActions
                  complete={done("adr")}
                  section="ADR, other details and prayer"
                  onEdit={() => review("adr")}
                />
              }
            >
              <KeyValues
                rows={[
                  { term: t("previewSection_openToSettlementAdr"), value: adrLabel(draft) },
                  { term: t("previewSection_interimRelief"), value: INTERIM_RELIEF_SUMMARY },
                  { term: t("previewSection_finalRelief"), value: finalReliefSummary(draft) },
                ]}
              />
            </FormCard>

            <FormCard
              title={t("previewSection_witnesses")}
              action={
                <CardActions
                  complete={done("witnesses")}
                  section="witnesses"
                  onEdit={() => review("witnesses")}
                />
              }
            >
              {witnesses.map((w) => (
                <SubBlock
                  key={w.key}
                  title={w.label}
                  rows={[
                    { term: w.term, value: w.name },
                    { term: t("previewSection_willProve"), value: w.prove },
                  ]}
                />
              ))}
            </FormCard>

            <FormCard
              title={t("previewSection_documents")}
              action={
                <CardActions
                  complete={done("documents")}
                  section="documents"
                  onEdit={() => review("documents")}
                />
              }
              contentClassName="gap-0"
            >
              {documents.lines.map((line, i) => (
                <p
                  key={i}
                  className="flex items-start gap-3 border-b border-hairline py-3 text-body-compact last:border-b-0"
                >
                  <span className="flex h-5 shrink-0 items-center">
                    <CheckIcon className="size-4 text-success-ink" aria-hidden />
                  </span>
                  {line}
                </p>
              ))}
              {documents.remaining ? (
                <p className="flex items-start gap-3 border-t border-hairline py-3 text-body-compact">
                  <span className="flex h-5 shrink-0 items-center">
                    <TriangleAlertIcon className="size-4 text-warning-ink" aria-hidden />
                  </span>
                  {documents.remaining} required document
                  {documents.remaining === 1 ? "" : "s"} still to upload
                </p>
              ) : null}
              {!documents.lines.length && !documents.remaining ? (
                <p className="py-3 text-body-compact text-muted-foreground">
                  {t("previewSection_noDocumentsAddedYet")}
                </p>
              ) : null}
            </FormCard>
          </TabsContent>

          {/* ── Court document ── */}
          <TabsContent value="document">
            <CourtDocument draft={draft} />
          </TabsContent>
        </Tabs>

        {validateError ? (
          <SectionNotice
            variant="destructive"
            title={t("previewSection_couldntCheckTheFilingWithThe")}
          >
            {validateError}
          </SectionNotice>
        ) : null}
      </FilingMain>

      {/* ── Review takes you to the section ── */}
      <Dialog
        open={!!panel}
        onOpenChange={(open) => {
          if (!open) setEditKey(null);
        }}
      >
        <ChromeDialogContent
          mobileSheet
          className="sm:max-w-md"
          onInteractOutside={(event) => event.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>
              {t("previewSection_openTheValueSection", { value: panel?.title ?? "" })}
            </DialogTitle>
            <DialogDescription>{t("previewSection_changesAreMadeInTheSection")}</DialogDescription>
          </DialogHeader>

          <Field orientation="horizontal">
            <Checkbox
              id="skip-review-prompt"
              checked={dontAsk}
              onCheckedChange={(checked) => setDontAsk(checked === true)}
            />
            <FieldLabel htmlFor="skip-review-prompt" className="font-normal">
              {t("previewSection_dontAskMeAgain")}
            </FieldLabel>
          </Field>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditKey(null)}>
              {t("previewSection_stayHere")}
            </Button>
            <Button type="button" onClick={confirmReview}>
              {t("previewSection_openSection")}
            </Button>
          </DialogFooter>
        </ChromeDialogContent>
      </Dialog>

      {/* ── Continue to sign was blocked: what the court still needs ── */}
      <Dialog
        open={!!problems}
        onOpenChange={(open) => {
          if (!open) setProblems(null);
        }}
      >
        <ChromeDialogContent mobileSheet className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("previewSection_someDetailsAreStillNeeded")}</DialogTitle>
            <DialogDescription>{t("previewSection_theCourtNeedsTheseBeforeYou")}</DialogDescription>
          </DialogHeader>

          <ul className="flex flex-col divide-y divide-hairline">
            {problems?.map((p, i) => {
              const step = stepForValidationField(p.field, p.message, participantStepById);
              return (
                <li key={`${p.field}-${i}`} className="flex items-start justify-between gap-3 py-3">
                  <span className="flex min-w-0 items-start gap-2 text-body-compact">
                    <TriangleAlertIcon
                      className="mt-0.5 size-4 shrink-0 text-warning-ink"
                      aria-hidden
                    />
                    {p.message}
                  </span>
                  {step ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                      onClick={() => {
                        setProblems(null);
                        router.push(hrefFor(step));
                      }}
                    >
                      {t("previewSection_goToTitle", { title: getStep(step).title })}
                    </Button>
                  ) : null}
                </li>
              );
            })}
          </ul>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setProblems(null)}>
              {t("common_close")}
            </Button>
          </DialogFooter>
        </ChromeDialogContent>
      </Dialog>

      <FilingFooter
        backHref={prev ? hrefFor(prev) : undefined}
        onContinue={continueToSign}
        continueDisabled={validating}
        continueLabel={
          validating
            ? t("previewSection_checking")
            : // A host that signs elsewhere (bulk filing signs the batch at once) is gone back to.
              !steps.includes("sign")
              ? t("previewSection_backToAllCases")
              : yourOathAhead
                ? t("previewSection_continueToSignAndOath")
                : t("previewSection_continueToSign")
        }
        showSaveState={false}
        status={
          readyToSign ? (
            <span className="inline-flex items-center gap-2 text-body-compact text-success-ink">
              <CheckIcon className="size-4" aria-hidden />
              {t("previewSection_reviewed")}
            </span>
          ) : (
            <IncompleteSections
              sections={incomplete.map((k) => ({
                key: k,
                title: courtText(panels[k].title),
                href: hrefFor(panels[k].step),
              }))}
            />
          )
        }
      />
    </>
  );
}
