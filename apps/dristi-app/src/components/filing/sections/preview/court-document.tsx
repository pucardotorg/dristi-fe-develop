/**
 * The complaint as the court will read it — a paper sheet rendered from the draft.
 *
 * Shared by Preview ("Court document" tab) and Sign (the document being signed), so both
 * screens print exactly the same paper. Every fact on the sheet comes from the draft: a
 * detail the person has not entered prints as "Not provided" rather than as a stand-in.
 */

import * as React from "react";

import { toLongDate } from "@/lib/filing/format";
import { CASE_TYPE, COURT, RETURN_REASONS } from "@/lib/filing/options";
import type { FilingDraft } from "@/lib/filing/types";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import {
  NOT_PROVIDED,
  accusedSummaries,
  adrLabel,
  advocateSummaries,
  chequeSummaries,
  complainantSummary,
  documentSummary,
  htmlToParagraphs,
  jurisdictionSummary,
  leadAdvocateName,
  affidavitBody,
  noticeSummary,
  optionLabel,
  orNot,
  witnessSummaries,
} from "./derive";
import { useCourtText } from "@/components/court/court-provider";
import { useTranslations } from "next-intl";
import { translateText } from "@/i18n/translate-text";

/* ───────────────────────────── Sheet primitives ────────────────────── */

function DocTable({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-2 overflow-x-auto">
      <table className="w-full table-fixed border-collapse">{children}</table>
    </div>
  );
}

function DocGroupRow({ children, span = 3 }: { children: React.ReactNode; span?: number }) {
  return (
    <tr>
      <td
        colSpan={span}
        className="border border-paper-border bg-paper-muted px-3 py-2 text-body-compact font-semibold text-paper-muted-foreground"
      >
        {children}
      </td>
    </tr>
  );
}

function DocCell({
  label,
  children,
  span,
}: {
  label?: string;
  children: React.ReactNode;
  span?: number;
}) {
  return (
    <td colSpan={span} className="border border-paper-border px-3 py-2 align-top">
      {label ? (
        <span className="block text-caption font-medium text-paper-muted-foreground">{label}</span>
      ) : null}
      <span className="block break-words text-body-compact">{children}</span>
    </td>
  );
}

function DocSection({ children }: { children: React.ReactNode }) {
  return <h3 className="mt-8 text-body font-semibold">{children}</h3>;
}

function DocSub({ children }: { children: React.ReactNode }) {
  return <h4 className="mt-6 text-body-compact font-semibold">{children}</h4>;
}

/** "+1 other" / "+3 others" appended to a case-title party name when more than one is on that side. */
function othersSuffix(count: number): string {
  const extra = count - 1;
  if (extra <= 0) return "";
  return ` +${extra} other${extra > 1 ? "s" : ""}`;
}

function DocP({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("mt-3 text-body-compact leading-relaxed", className)}>{children}</p>;
}

/* ───────────────────────────── The document ────────────────────────── */

export function CourtDocument({ draft }: { draft: FilingDraft }) {
  const t = useTranslations();
  const courtText = useCourtText();
  const complainant = complainantSummary(draft.complainants[0]);
  const advocates = advocateSummaries(draft);
  const accused = accusedSummaries(draft);
  const cheques = chequeSummaries(draft);
  const notice = noticeSummary(draft.notices[0]);
  const jurisdiction = jurisdictionSummary(draft);
  const witnesses = witnessSummaries(draft);
  const documents = documentSummary(draft);

  const longDate = (iso: string) => orNot(toLongDate(iso));

  const firstAccused = accused[0];
  const otherDetails = htmlToParagraphs(draft.adr.otherDetails);
  const interimRelief = htmlToParagraphs(draft.adr.interimRelief);
  const finalRelief = htmlToParagraphs(draft.adr.finalRelief);

  return (
    <Card variant="raised" className="gap-0 p-6 font-sans text-foreground sm:p-8">
      {/* Court and cause title */}
      <div className="flex flex-col gap-1 text-center">
        <p className="text-caption font-medium tracking-wide text-paper-muted-foreground">
          {t("previewCourtDocument_inTheCourtText", { courtText: courtText(COURT.name) })}
        </p>
        {/* No registration-number line: a draft has no number until registration, in
            any state (owner, 2026-10-09). */}
      </div>

      {/* Parties — age is printed only when it was collected. */}
      <div className="mt-4 flex items-start justify-between gap-4 py-1">
        <div className="min-w-0">
          <p className="text-body-compact font-semibold break-words">
            {complainant.name}
            {othersSuffix(draft.complainants.length)}
          </p>
          <p className="mt-1 text-caption font-medium leading-relaxed text-paper-muted-foreground">
            {complainant.age ? (
              <>
                {t("previewCourtDocument_agedAgeYears", { age: complainant.age })}
                <br />
              </>
            ) : null}
            R/o {complainant.presentAddress}
          </p>
        </div>
        <p className="shrink-0 text-body-compact italic">{t("previewCourtDocument_complainant")}</p>
      </div>

      <p className="py-1 text-center text-body-compact italic">
        {t("previewCourtDocument_versus")}
      </p>

      <div className="flex items-start justify-between gap-4 py-1">
        <div className="min-w-0">
          <p className="text-body-compact font-semibold break-words">
            {firstAccused ? firstAccused.heading : NOT_PROVIDED}
            {othersSuffix(accused.length)}
          </p>
          <p className="mt-1 text-caption font-medium leading-relaxed text-paper-muted-foreground">
            R/o {firstAccused ? firstAccused.address : NOT_PROVIDED}
          </p>
        </div>
        <p className="shrink-0 text-body-compact italic">{t("previewCourtDocument_accused")}</p>
      </div>

      {/* Legal heading — the case type's own long-form proceeding title. */}
      <h2 className="mt-4 text-center text-body font-semibold uppercase">
        {t(CASE_TYPE.proceedingTitleLong)}
      </h2>

      {/* ── Synopsis ── */}
      <DocSection>{t("previewCourtDocument_synopsis")}</DocSection>
      <DocTable>
        <tbody>
          <DocGroupRow>{t("previewCourtDocument_parties")}</DocGroupRow>
          <tr>
            <DocCell label={t("previewCourtDocument_complainantName")}>{complainant.name}</DocCell>
            <DocCell label={t("previewCourtDocument_accusedName")}>
              {firstAccused ? firstAccused.heading : NOT_PROVIDED}
            </DocCell>
            <DocCell label={t("previewCourtDocument_complainantsAdvocateName")}>
              {leadAdvocateName(draft)}
            </DocCell>
          </tr>

          <DocGroupRow>{t("previewCourtDocument_chequeDetails")}</DocGroupRow>
          <tr>
            <DocCell label={t("previewCourtDocument_dateOnCheque")}>
              {longDate(draft.cheques[0]?.dateOnCheque ?? "")}
            </DocCell>
            <DocCell label={t("previewCourtDocument_amount")}>
              {cheques[0]?.amount ?? NOT_PROVIDED}
            </DocCell>
            <DocCell label={t("previewCourtDocument_chequeNumber")}>
              {cheques[0]?.number ?? NOT_PROVIDED}
            </DocCell>
          </tr>
          <tr>
            <DocCell label={t("previewCourtDocument_bankName")}>
              {cheques[0]?.bankName ?? NOT_PROVIDED}
            </DocCell>
            <DocCell label={t("previewCourtDocument_bankBranch")} span={2}>
              {cheques[0]?.bankBranch ?? NOT_PROVIDED}
            </DocCell>
          </tr>

          <DocGroupRow>{t("previewCourtDocument_dishonour")}</DocGroupRow>
          <tr>
            <DocCell label={t("previewCourtDocument_dateOfPresentation")}>
              {longDate(draft.cheques[0]?.presentDate ?? "")}
            </DocCell>
            <DocCell label={t("previewCourtDocument_dateOnReturnMemo")}>
              {longDate(draft.cheques[0]?.returnDate ?? "")}
            </DocCell>
            <DocCell label={t("previewCourtDocument_returnReason")}>
              {cheques[0]?.returnReason ?? NOT_PROVIDED}
            </DocCell>
          </tr>
          <tr>
            <DocCell label={t("previewCourtDocument_bankBranchComplainant")} span={3}>
              {jurisdiction.bank}
            </DocCell>
          </tr>

          <DocGroupRow>{t("previewCourtDocument_demandNotice")}</DocGroupRow>
          <tr>
            <DocCell label={t("previewCourtDocument_dateOfDispatchOfDemandNotice")}>
              {longDate(draft.notices[0]?.dispatchDate ?? "")}
            </DocCell>
            <DocCell label={t("previewCourtDocument_modeOfService")}>{notice.mode}</DocCell>
            <DocCell label={t("previewCourtDocument_whetherDelivered")}>
              {notice.deliveredYesNo}
            </DocCell>
          </tr>
          <tr>
            <DocCell label={t("previewCourtDocument_dateOfDelivery")}>
              {longDate(draft.notices[0]?.deliveryDate ?? "")}
            </DocCell>
            <DocCell label={t("previewCourtDocument_hasTheAccusedRepliedToThe")} span={2}>
              {notice.replied}
            </DocCell>
          </tr>

          <DocGroupRow>{t("previewCourtDocument_causeOfAction")}</DocGroupRow>
          <tr>
            <DocCell label={t("previewCourtDocument_dateOfCauseOfAction")}>
              {longDate(jurisdiction.causeDateIso)}
            </DocCell>
            <DocCell label={t("previewCourtDocument_jurisdictionInvokedUnderSection1422")}>
              {jurisdiction.depositedByPayee
                ? t("previewCourtDocument_bankBranchTheComplainantsBankBranch", {
                    bankBranch: jurisdiction.bankBranch,
                  })
                : t("previewCourtDocument_drawerAccusedBankBranch")}
            </DocCell>
            <DocCell label={t("previewCourtDocument_anyOtherComplaintPendingBetweenThe")}>
              {jurisdiction.otherPending}
            </DocCell>
          </tr>

          <DocGroupRow>{t("previewCourtDocument_prayerReliefSought")}</DocGroupRow>
          <tr>
            <DocCell span={3}>
              {[...finalRelief, ...interimRelief].join(" ") || NOT_PROVIDED}
            </DocCell>
          </tr>
        </tbody>
      </DocTable>

      {/* ── 1. Party details ── */}
      <DocSection>{t("previewCourtDocument_1PartyDetails")}</DocSection>

      <DocSub>{t("previewCourtDocument_11Complainant")}</DocSub>
      <DocTable>
        <tbody>
          <DocGroupRow>{t("previewCourtDocument_complainant1")}</DocGroupRow>
          <tr>
            <DocCell label={t("previewCourtDocument_complainantType")}>{complainant.type}</DocCell>
            <DocCell label={t("previewCourtDocument_fullName")}>{complainant.name}</DocCell>
            <DocCell label={t("previewCourtDocument_mobileNumber")}>{complainant.mobile}</DocCell>
          </tr>
          <tr>
            <DocCell label={t("previewCourtDocument_emailAddress")}>{complainant.email}</DocCell>
            <DocCell label={t("previewCourtDocument_permanentAddress")}>
              {complainant.permanentAddress}
            </DocCell>
            <DocCell label={t("previewCourtDocument_presentAddress")}>
              {complainant.presentAddress}
            </DocCell>
          </tr>
          <tr>
            <DocCell label={t("previewCourtDocument_poAForComplainant1")} span={3}>
              {complainant.poa}
            </DocCell>
          </tr>
        </tbody>
      </DocTable>

      <DocSub>{t("previewCourtDocument_12AdvocateComplainant")}</DocSub>
      {advocates.length ? (
        <DocTable>
          <tbody>
            {advocates.map((a) => (
              <React.Fragment key={a.key}>
                <DocGroupRow span={2}>
                  {a.forAll
                    ? t("previewCourtDocument_advocateForAllComplainants")
                    : t("previewCourtDocument_advocateForAppearingFor", {
                        appearingFor: a.appearingFor,
                      })}
                </DocGroupRow>
                <tr>
                  <DocCell label={t("previewCourtDocument_fullName")}>{a.name}</DocCell>
                  <DocCell label={t("previewCourtDocument_barRegistration")}>{a.bar}</DocCell>
                </tr>
              </React.Fragment>
            ))}
          </tbody>
        </DocTable>
      ) : (
        <DocP className="text-paper-muted-foreground">
          {t("previewCourtDocument_noAdvocateHasBeenAddedThe")}
        </DocP>
      )}

      <DocSub>{t("previewCourtDocument_13Accused")}</DocSub>
      <DocTable>
        <tbody>
          {accused.map((a) => (
            <React.Fragment key={a.key}>
              <DocGroupRow>{a.label}</DocGroupRow>
              <tr>
                <DocCell
                  label={
                    a.isEntity
                      ? t("previewCourtDocument_typeOfEntity")
                      : t("previewCourtDocument_type")
                  }
                >
                  {a.type}
                </DocCell>
                <DocCell label={t("previewCourtDocument_fullName")}>{a.name}</DocCell>
                <DocCell label={t("previewCourtDocument_address")}>{a.address}</DocCell>
              </tr>
            </React.Fragment>
          ))}
        </tbody>
      </DocTable>

      {/* ── 2. Case details ── */}
      <DocSection>{t("previewCourtDocument_2CaseDetails")}</DocSection>

      <DocSub>{t("previewCourtDocument_21ChequeAndReturnMemo")}</DocSub>
      <DocTable>
        <tbody>
          {cheques.map((c, i) => (
            <React.Fragment key={c.key}>
              <DocGroupRow>{c.label}</DocGroupRow>
              <tr>
                <DocCell label={t("previewCourtDocument_dateOnCheque")}>
                  {longDate(draft.cheques[i].dateOnCheque)}
                </DocCell>
                <DocCell label={t("previewCourtDocument_amount")}>{c.amount}</DocCell>
                <DocCell label={t("previewCourtDocument_chequeNumber")}>{c.number}</DocCell>
              </tr>
              <tr>
                <DocCell label={t("previewCourtDocument_bankName")}>{c.bankName}</DocCell>
                <DocCell label={t("previewCourtDocument_bankBranch")} span={2}>
                  {c.bankBranch}
                </DocCell>
              </tr>
              <tr>
                <DocCell label={t("previewCourtDocument_dateOfPresentation")}>
                  {longDate(draft.cheques[i].presentDate)}
                </DocCell>
                <DocCell label={t("previewCourtDocument_dateOfReturn")}>
                  {longDate(draft.cheques[i].returnDate)}
                </DocCell>
                <DocCell label={t("previewCourtDocument_returnReason")}>
                  {orNot(optionLabel(RETURN_REASONS, draft.cheques[i].returnReason))}
                </DocCell>
              </tr>
            </React.Fragment>
          ))}
        </tbody>
      </DocTable>

      <DocSub>{t("previewCourtDocument_22DemandNoticeDetails")}</DocSub>
      <DocTable>
        <tbody>
          {draft.notices.map((n, i) => {
            const s = noticeSummary(n);
            return (
              <React.Fragment key={n.id}>
                <DocGroupRow>
                  {t("previewCourtDocument_demandNoticeValue", { value: String(i + 1) })}
                </DocGroupRow>
                <tr>
                  <DocCell label={t("previewCourtDocument_natureOfDebtOrOtherLiability")} span={3}>
                    {s.nature}
                  </DocCell>
                </tr>
                <tr>
                  <DocCell label={t("previewCourtDocument_dateOfDispatchOfDemandNotice")}>
                    {longDate(n.dispatchDate)}
                  </DocCell>
                  <DocCell label={t("previewCourtDocument_modeOfService")}>{s.mode}</DocCell>
                  <DocCell label={t("previewCourtDocument_whetherDelivered")}>
                    {s.deliveredYesNo}
                  </DocCell>
                </tr>
                <tr>
                  <DocCell label={t("previewCourtDocument_dateOfDelivery")}>
                    {longDate(n.deliveryDate)}
                  </DocCell>
                  <DocCell label={t("previewCourtDocument_hasTheAccusedRepliedToThe")}>
                    {s.replied}
                  </DocCell>
                  <DocCell label={t("previewCourtDocument_hasTheDrawerMadeFullOr")}>
                    {translateText(t, s.paidYesNo)}
                  </DocCell>
                </tr>
              </React.Fragment>
            );
          })}
        </tbody>
      </DocTable>

      <DocSub>{t("previewCourtDocument_23JurisdictionAndLimitation")}</DocSub>
      <DocTable>
        <tbody>
          <tr>
            <DocCell label={t("previewCourtDocument_wasTheChequeDeliveredForCollection")} span={3}>
              {jurisdiction.depositedByPayee
                ? t("previewCourtDocument_yes")
                : t("previewCourtDocument_no")}
            </DocCell>
          </tr>
          {jurisdiction.depositedByPayee ? (
            <>
              <DocGroupRow>{t("previewCourtDocument_payeeComplainantBankDetails")}</DocGroupRow>
              <tr>
                <DocCell label={t("previewCourtDocument_ifscCode")}>{jurisdiction.ifsc}</DocCell>
                <DocCell label={t("previewCourtDocument_bankName")}>
                  {jurisdiction.bankName}
                </DocCell>
                <DocCell label={t("previewCourtDocument_bankBranch")}>
                  {jurisdiction.bankBranch}
                </DocCell>
              </tr>
            </>
          ) : null}
          <tr>
            <DocCell label={t("previewCourtDocument_policeStation")} span={3}>
              {jurisdiction.police}
            </DocCell>
          </tr>
          <DocGroupRow>
            {t("previewCourtDocument_otherChequeDishonourComplaintsBetweenThe")}
          </DocGroupRow>
          <tr>
            <DocCell label={t("previewCourtDocument_isThereAnyOtherChequeDishonour")} span={3}>
              {jurisdiction.otherPending}
            </DocCell>
          </tr>
          {jurisdiction.otherCases.map((c, i) => (
            <tr key={`${c.court}-${c.caseNumber}-${i}`}>
              <DocCell label={t("previewCourtDocument_court")}>{orNot(c.court)}</DocCell>
              <DocCell label={t("previewCourtDocument_caseNumber")} span={2}>
                {orNot(c.caseNumber)}
              </DocCell>
            </tr>
          ))}
          <tr>
            <DocCell label={t("previewCourtDocument_dateOfCauseOfAction")}>
              {longDate(jurisdiction.causeDateIso)}
            </DocCell>
            <DocCell label={t("previewCourtDocument_dateOfComplaintFiling")}>
              {longDate(jurisdiction.filingDateIso)}
            </DocCell>
            <DocCell label={t("previewCourtDocument_durationOfDelay")}>
              {translateText(t, jurisdiction.delayText)}
            </DocCell>
          </tr>
          {jurisdiction.condonationReason ? (
            <tr>
              <DocCell
                label={t("previewCourtDocument_reasonForPrayingCondonationOfDelay")}
                span={3}
              >
                {jurisdiction.condonationReason}
              </DocCell>
            </tr>
          ) : null}
        </tbody>
      </DocTable>

      <DocSub>{t("previewCourtDocument_24AdrPrayerAndOther")}</DocSub>
      <DocTable>
        <tbody>
          <tr>
            <DocCell label={t("previewCourtDocument_isTheComplainantWillingToSettle")} span={3}>
              {adrLabel(draft)}
            </DocCell>
          </tr>
        </tbody>
      </DocTable>
      <p className="mt-4 text-body-compact font-semibold">
        {t("previewCourtDocument_anyAdditionalDetails")}
      </p>
      {otherDetails.length ? (
        /* The filer's text as written — paragraphs and lists kept. */
        <div
          className="mt-2 flex flex-col gap-2 text-body-compact leading-relaxed [&_li]:mb-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_ul]:list-disc [&_ul]:pl-6"
          dangerouslySetInnerHTML={{
            __html: courtText(draft.adr.otherDetails),
          }}
        />
      ) : (
        <DocP className="text-paper-muted-foreground">{NOT_PROVIDED}</DocP>
      )}
      <p className="mt-4 text-body-compact font-semibold">
        {t("previewCourtDocument_interimRelief")}
      </p>
      {interimRelief.length ? (
        interimRelief.map((p, i) => <DocP key={i}>{p}</DocP>)
      ) : (
        <DocP className="text-paper-muted-foreground">{NOT_PROVIDED}</DocP>
      )}
      <p className="mt-4 text-body-compact font-semibold">
        {t("previewCourtDocument_finalRelief")}
      </p>
      {finalRelief.length ? (
        finalRelief.map((p, i) => (
          <DocP key={i} className={i > 0 ? "ml-4" : undefined}>
            {p}
          </DocP>
        ))
      ) : (
        <DocP className="text-paper-muted-foreground">{NOT_PROVIDED}</DocP>
      )}

      {/* ── 3. Evidence ── */}
      <DocSection>{t("previewCourtDocument_3Evidence")}</DocSection>

      <DocSub>{t("previewCourtDocument_31ListOfWitnesses")}</DocSub>
      <DocTable>
        <tbody>
          {witnesses.map((w) => (
            <React.Fragment key={w.key}>
              <DocGroupRow>{w.label}</DocGroupRow>
              <tr>
                <DocCell
                  label={
                    w.term === "Designation"
                      ? t("previewCourtDocument_designation")
                      : t("previewCourtDocument_fullName")
                  }
                >
                  {w.name}
                </DocCell>
                <DocCell label={t("previewCourtDocument_whatWillThisWitnessProve")} span={2}>
                  {w.prove}
                </DocCell>
              </tr>
              <tr>
                <DocCell label={t("previewCourtDocument_mobileNumber")}>{w.mobile}</DocCell>
                <DocCell label={t("previewCourtDocument_emailId")}>{w.email}</DocCell>
                <DocCell label={t("previewCourtDocument_address")}>{w.address}</DocCell>
              </tr>
            </React.Fragment>
          ))}
        </tbody>
      </DocTable>

      <DocSub>{t("previewCourtDocument_32ListOfDocuments")}</DocSub>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full table-fixed border-collapse">
          <colgroup>
            <col className="w-12" />
            <col />
            <col className="w-32" />
          </colgroup>
          <thead>
            <tr>
              <th className="border border-paper-border bg-paper-muted px-3 py-2 text-left text-body-compact font-semibold text-paper-muted-foreground">
                {t("previewCourtDocument_sNo")}
              </th>
              <th className="border border-paper-border bg-paper-muted px-3 py-2 text-left text-body-compact font-semibold text-paper-muted-foreground">
                {t("previewCourtDocument_documentName")}
              </th>
              <th className="border border-paper-border bg-paper-muted px-3 py-2 text-left text-body-compact font-semibold text-paper-muted-foreground">
                {t("previewCourtDocument_nativelyDigital")}
              </th>
            </tr>
          </thead>
          <tbody>
            {documents.uploaded.length ? (
              documents.uploaded.map((d, i) => (
                <tr key={d.id}>
                  <DocCell>{i + 1}.</DocCell>
                  <DocCell>
                    {d.name}
                    {d.file ? (
                      <span className="mt-0.5 block text-caption text-paper-muted-foreground">
                        {d.file.name}
                      </span>
                    ) : null}
                  </DocCell>
                  <DocCell>
                    {d.digital ? t("previewCourtDocument_yes") : t("previewCourtDocument_no")}
                  </DocCell>
                </tr>
              ))
            ) : (
              <tr>
                <DocCell span={3}>
                  {t("previewCourtDocument_noDocumentsHaveBeenUploadedYet")}
                </DocCell>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <DocP>
        {t("previewCourtDocument_signedOnValuePleaseSeePage", {
          value: jurisdiction.filingDateIso ? toLongDate(jurisdiction.filingDateIso) : "__",
        })}
      </DocP>

      {/* ── 4. Affidavit ── */}
      <DocSection>{t("previewCourtDocument_4Affidavit")}</DocSection>
      {/*
        The same text the Affidavit step shows and the filer may have edited — rendered
        from one expression rather than regenerated here, because a sworn document that
        disagrees with the form it came from is the worst outcome available.
      */}
      <div
        className="flex flex-col gap-3 [&_p]:text-body-compact [&_p]:leading-relaxed"
        dangerouslySetInnerHTML={{ __html: affidavitBody(draft) }}
      />

      <h4 className="mt-8 text-body-compact font-semibold">
        {t("previewCourtDocument_complainant2")}
      </h4>
      <DocP>
        {t("previewCourtDocument_iConfirmThatIHaveRead")}
        <br />
        {t("previewCourtDocument_1Complaint")}
        <br />
        {t("previewCourtDocument_2AffidavitOfFact")}
      </DocP>
      <h4 className="mt-6 text-body-compact font-semibold">{t("previewCourtDocument_advocate")}</h4>
      <DocP>{t("previewCourtDocument_iConfirmTheIdentityOfThe")}</DocP>
      <DocP>{t("previewCourtDocument_iConfirmThatTheComplaintHas")}</DocP>
      <DocP className="text-center">***</DocP>
      <DocP className="text-paper-muted-foreground">
        {t("previewCourtDocument_pleaseTurnOverThePageTo")}
      </DocP>
    </Card>
  );
}
