import {useTranslations as __useTranslations} from "@/i18n/server-translations";
import {LocalizedText as __LocalizedText} from "@/components/localized-text";
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
import { PANEL_CLASS } from "@/components/filing/form-card";
import {
  INTERIM_RELIEF_SUMMARY,
  NOT_PROVIDED,
  accusedSummaries,
  adrLabel,
  advocateSummaries,
  chequeSummaries,
  complainantSummary,
  documentSummary,
  finalReliefSummary,
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

/* ───────────────────────────── Sheet primitives ────────────────────── */

function DocTable({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-2 overflow-x-auto">
      <table className="w-full table-fixed border-collapse">{children}</table>
    </div>
  );
}

function DocGroupRow({
  children,
  span = 3,
}: {
  children: React.ReactNode;
  span?: number;
}) {
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
  const __t = __useTranslations();
  return (
    <td colSpan={span} className="border border-paper-border px-3 py-2 align-top">
      {label ? (
        <span className="block text-caption font-medium text-paper-muted-foreground">
          {__t(label)}
        </span>
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

function DocP({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p className={cn("mt-3 text-body-compact leading-relaxed", className)}>{children}</p>
  );
}

/* ───────────────────────────── The document ────────────────────────── */

export function CourtDocument({ draft }: { draft: FilingDraft }) {
  const __t = __useTranslations();
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
    <Card className={cn(PANEL_CLASS, "gap-0 p-6 font-sans text-foreground sm:p-8")}>
      {/* Court and cause title */}
      <div className="flex flex-col gap-1 text-center">
        <p className="text-caption font-medium tracking-wide text-paper-muted-foreground">
          {<__LocalizedText id="courtDocument_inThe" />}{" "}{courtText(COURT.name)}
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
                {<__LocalizedText id="courtDocument_aged" />}{" "}{complainant.age} {<__LocalizedText id="courtDocument_years" />}{" "}<br />
              </>
            ) : null}
            R/o {complainant.presentAddress}
          </p>
        </div>
        <p className="shrink-0 text-body-compact italic">{<__LocalizedText id="courtDocument_complainant" />}</p>
      </div>

      <p className="py-1 text-center text-body-compact italic">{<__LocalizedText id="courtDocument_versus" />}</p>

      <div className="flex items-start justify-between gap-4 py-1">
        <div className="min-w-0">
          <p className="text-body-compact font-semibold break-words">
            {firstAccused ? __t(firstAccused.heading) : NOT_PROVIDED}
            {othersSuffix(accused.length)}
          </p>
          <p className="mt-1 text-caption font-medium leading-relaxed text-paper-muted-foreground">
            R/o {firstAccused ? firstAccused.address : NOT_PROVIDED}
          </p>
        </div>
        <p className="shrink-0 text-body-compact italic">{<__LocalizedText id="courtDocument_accused" />}</p>
      </div>

      {/* Legal heading — the case type's own long-form proceeding title. */}
      <h2 className="mt-4 text-center text-body font-semibold uppercase">
        {CASE_TYPE.proceedingTitleLong}
      </h2>

      {/* ── Synopsis ── */}
      <DocSection>{<__LocalizedText id="courtDocument_synopsis" />}</DocSection>
      <DocTable>
        <tbody>
          <DocGroupRow>{<__LocalizedText id="courtDocument_parties" />}</DocGroupRow>
          <tr>
            <DocCell label={__t("courtDocument_complainantName")}>{complainant.name}</DocCell>
            <DocCell label={__t("courtDocument_accusedName")}>
              {firstAccused ? __t(firstAccused.heading) : NOT_PROVIDED}
            </DocCell>
            <DocCell label={__t("courtDocument_complainantSAdvocateName")}>
              {leadAdvocateName(draft)}
            </DocCell>
          </tr>

          <DocGroupRow>{<__LocalizedText id="courtDocument_chequeDetails" />}</DocGroupRow>
          <tr>
            <DocCell label={__t("courtDocument_dateOnCheque")}>
              {longDate(draft.cheques[0]?.dateOnCheque ?? "")}
            </DocCell>
            <DocCell label={__t("courtDocument_amount")}>{cheques[0]?.amount ?? NOT_PROVIDED}</DocCell>
            <DocCell label={__t("courtDocument_chequeNumber")}>{cheques[0]?.number ?? NOT_PROVIDED}</DocCell>
          </tr>
          <tr>
            <DocCell label={__t("courtDocument_bankName")}>{cheques[0]?.bankName ?? NOT_PROVIDED}</DocCell>
            <DocCell label={__t("courtDocument_bankBranch")} span={2}>
              {cheques[0]?.bankBranch ?? NOT_PROVIDED}
            </DocCell>
          </tr>

          <DocGroupRow>{<__LocalizedText id="courtDocument_dishonour" />}</DocGroupRow>
          <tr>
            <DocCell label={__t("courtDocument_dateOfPresentation")}>
              {longDate(draft.cheques[0]?.presentDate ?? "")}
            </DocCell>
            <DocCell label={__t("courtDocument_dateOnReturnMemo")}>
              {longDate(draft.cheques[0]?.returnDate ?? "")}
            </DocCell>
            <DocCell label={__t("courtDocument_returnReason")}>
              {cheques[0]?.returnReason ?? NOT_PROVIDED}
            </DocCell>
          </tr>
          <tr>
            <DocCell label={__t("courtDocument_bankBranchComplainant")} span={3}>
              {jurisdiction.bank}
            </DocCell>
          </tr>

          <DocGroupRow>{<__LocalizedText id="courtDocument_demandNotice" />}</DocGroupRow>
          <tr>
            <DocCell label={__t("courtDocument_dateOfDispatchOfDemandNotice")}>
              {longDate(draft.notices[0]?.dispatchDate ?? "")}
            </DocCell>
            <DocCell label={__t("courtDocument_modeOfService")}>{notice.mode}</DocCell>
            <DocCell label={__t("courtDocument_whetherDelivered")}>{notice.deliveredYesNo}</DocCell>
          </tr>
          <tr>
            <DocCell label={__t("courtDocument_dateOfDelivery")}>
              {longDate(draft.notices[0]?.deliveryDate ?? "")}
            </DocCell>
            <DocCell label={__t("courtDocument_hasTheAccusedRepliedToTheDemand")} span={2}>
              {notice.replied}
            </DocCell>
          </tr>

          <DocGroupRow>{<__LocalizedText id="courtDocument_causeOfAction" />}</DocGroupRow>
          <tr>
            <DocCell label={__t("courtDocument_dateOfCauseOfAction")}>
              {longDate(jurisdiction.causeDateIso)}
            </DocCell>
            <DocCell label={__t("courtDocument_jurisdictionInvokedUnderSection1422")}>
              {jurisdiction.depositedByPayee
                ? `${jurisdiction.bankBranch}, the complainant’s bank branch`
                : __t("courtDocument_drawerAccusedBankBranch")}
            </DocCell>
            <DocCell label={__t("courtDocument_anyOtherComplaintPendingBetweenTheSame")}>
              {jurisdiction.otherPending}
            </DocCell>
          </tr>

          <DocGroupRow>{<__LocalizedText id="courtDocument_prayerReliefSought" />}</DocGroupRow>
          <tr>
            <DocCell span={3}>
              {finalReliefSummary(draft)}. {INTERIM_RELIEF_SUMMARY}.
            </DocCell>
          </tr>
        </tbody>
      </DocTable>

      {/* ── 1. Party details ── */}
      <DocSection>{<__LocalizedText id="courtDocument_1PartyDetails" />}</DocSection>

      <DocSub>{<__LocalizedText id="courtDocument_11Complainant" />}</DocSub>
      <DocTable>
        <tbody>
          <DocGroupRow>{<__LocalizedText id="courtDocument_complainant1" />}</DocGroupRow>
          <tr>
            <DocCell label={__t("courtDocument_complainantType")}>{complainant.type}</DocCell>
            <DocCell label={__t("courtDocument_fullName")}>{complainant.name}</DocCell>
            <DocCell label={__t("courtDocument_mobileNumber")}>{complainant.mobile}</DocCell>
          </tr>
          <tr>
            <DocCell label={__t("courtDocument_emailAddress")}>{complainant.email}</DocCell>
            <DocCell label={__t("courtDocument_permanentAddress")}>{complainant.permanentAddress}</DocCell>
            <DocCell label={__t("courtDocument_presentAddress")}>{complainant.presentAddress}</DocCell>
          </tr>
          <tr>
            <DocCell label={__t("courtDocument_poaForComplainant1")} span={3}>
              {complainant.poa}
            </DocCell>
          </tr>
        </tbody>
      </DocTable>

      <DocSub>{<__LocalizedText id="courtDocument_12AdvocateComplainant" />}</DocSub>
      {advocates.length ? (
        <DocTable>
          <tbody>
            {advocates.map((a) => (
              <React.Fragment key={a.key}>
                <DocGroupRow span={2}>
                  {a.forAll
                    ? __t("courtDocument_advocateForAllComplainants")
                    : __t("courtDocument_advocateForValue0", {value0: String(a.appearingFor)})}
                </DocGroupRow>
                <tr>
                  <DocCell label={__t("courtDocument_fullName")}>{a.name}</DocCell>
                  <DocCell label={__t("courtDocument_barRegistration")}>{a.bar}</DocCell>
                </tr>
              </React.Fragment>
            ))}
          </tbody>
        </DocTable>
      ) : (
        <DocP className="text-paper-muted-foreground">
          {<__LocalizedText id="courtDocument_noAdvocateHasBeenAddedTheComplainant" />}{" "}</DocP>
      )}

      <DocSub>{<__LocalizedText id="courtDocument_13Accused" />}</DocSub>
      <DocTable>
        <tbody>
          {accused.map((a) => (
            <React.Fragment key={a.key}>
              <DocGroupRow>{__t(a.label)}</DocGroupRow>
              <tr>
                <DocCell label={a.isEntity ? __t("courtDocument_typeOfEntity") : __t("courtDocument_type")}>{a.type}</DocCell>
                <DocCell label={__t("courtDocument_fullName")}>{a.name}</DocCell>
                <DocCell label={__t("courtDocument_address")}>{a.address}</DocCell>
              </tr>
            </React.Fragment>
          ))}
        </tbody>
      </DocTable>

      {/* ── 2. Case details ── */}
      <DocSection>{<__LocalizedText id="courtDocument_2CaseDetails" />}</DocSection>

      <DocSub>{<__LocalizedText id="courtDocument_21ChequeAndReturnMemoDetails" />}</DocSub>
      <DocTable>
        <tbody>
          {cheques.map((c, i) => (
            <React.Fragment key={c.key}>
              <DocGroupRow>{__t(c.label)}</DocGroupRow>
              <tr>
                <DocCell label={__t("courtDocument_dateOnCheque")}>
                  {longDate(draft.cheques[i].dateOnCheque)}
                </DocCell>
                <DocCell label={__t("courtDocument_amount")}>{c.amount}</DocCell>
                <DocCell label={__t("courtDocument_chequeNumber")}>{c.number}</DocCell>
              </tr>
              <tr>
                <DocCell label={__t("courtDocument_bankName")}>{c.bankName}</DocCell>
                <DocCell label={__t("courtDocument_bankBranch")} span={2}>
                  {c.bankBranch}
                </DocCell>
              </tr>
              <tr>
                <DocCell label={__t("courtDocument_dateOfPresentation")}>
                  {longDate(draft.cheques[i].presentDate)}
                </DocCell>
                <DocCell label={__t("courtDocument_dateOfReturn")}>
                  {longDate(draft.cheques[i].returnDate)}
                </DocCell>
                <DocCell label={__t("courtDocument_returnReason")}>
                  {orNot(optionLabel(RETURN_REASONS, draft.cheques[i].returnReason))}
                </DocCell>
              </tr>
            </React.Fragment>
          ))}
        </tbody>
      </DocTable>

      <DocSub>{<__LocalizedText id="courtDocument_22DemandNoticeDetails" />}</DocSub>
      <DocTable>
        <tbody>
          {draft.notices.map((n, i) => {
            const s = noticeSummary(n);
            return (
              <React.Fragment key={n.id}>
                <DocGroupRow>{<__LocalizedText id="courtDocument_demandNotice" />}{" "}{i + 1}</DocGroupRow>
                <tr>
                  <DocCell label={__t("courtDocument_natureOfDebtOrOtherLiability")} span={3}>
                    {s.nature}
                  </DocCell>
                </tr>
                <tr>
                  <DocCell label={__t("courtDocument_dateOfDispatchOfDemandNotice")}>
                    {longDate(n.dispatchDate)}
                  </DocCell>
                  <DocCell label={__t("courtDocument_modeOfService")}>{s.mode}</DocCell>
                  <DocCell label={__t("courtDocument_whetherDelivered")}>{s.deliveredYesNo}</DocCell>
                </tr>
                <tr>
                  <DocCell label={__t("courtDocument_dateOfDelivery")}>{longDate(n.deliveryDate)}</DocCell>
                  <DocCell label={__t("courtDocument_hasTheAccusedRepliedToTheDemand")}>
                    {s.replied}
                  </DocCell>
                  <DocCell label={__t("courtDocument_hasTheDrawerMadeFullOrPart")}>
                    {s.paidYesNo}
                  </DocCell>
                </tr>
              </React.Fragment>
            );
          })}
        </tbody>
      </DocTable>

      <DocSub>{<__LocalizedText id="courtDocument_23JurisdictionAndLimitation" />}</DocSub>
      <DocTable>
        <tbody>
          <tr>
            <DocCell
              label={__t("courtDocument_wasTheChequeDeliveredForCollectionAt")}
              span={3}
            >
              {jurisdiction.depositedByPayee ? __t("courtDocument_yes") : __t("courtDocument_no")}
            </DocCell>
          </tr>
          {jurisdiction.depositedByPayee ? (
            <>
              <DocGroupRow>{<__LocalizedText id="courtDocument_payeeComplainantBankDetails" />}</DocGroupRow>
              <tr>
                <DocCell label={__t("courtDocument_ifscCode")}>{jurisdiction.ifsc}</DocCell>
                <DocCell label={__t("courtDocument_bankName")}>{jurisdiction.bankName}</DocCell>
                <DocCell label={__t("courtDocument_bankBranch")}>{jurisdiction.bankBranch}</DocCell>
              </tr>
            </>
          ) : null}
          <tr>
            <DocCell label={__t("courtDocument_policeStation")} span={3}>
              {jurisdiction.police}
            </DocCell>
          </tr>
          <DocGroupRow>
            {<__LocalizedText id="courtDocument_otherChequeDishonourComplaintsBetweenTheSame" />}{" "}</DocGroupRow>
          <tr>
            <DocCell
              label={__t("courtDocument_isThereAnyOtherChequeDishonourComplaint")}
              span={3}
            >
              {jurisdiction.otherPending}
            </DocCell>
          </tr>
          {jurisdiction.otherCases.map((c, i) => (
            <tr key={`${c.court}-${c.caseNumber}-${i}`}>
              <DocCell label={__t("courtDocument_court")}>{orNot(c.court)}</DocCell>
              <DocCell label={__t("courtDocument_caseNumber")} span={2}>
                {orNot(c.caseNumber)}
              </DocCell>
            </tr>
          ))}
          <tr>
            <DocCell label={__t("courtDocument_dateOfCauseOfAction")}>
              {longDate(jurisdiction.causeDateIso)}
            </DocCell>
            <DocCell label={__t("courtDocument_dateOfComplaintFiling")}>
              {longDate(jurisdiction.filingDateIso)}
            </DocCell>
            <DocCell label={__t("courtDocument_durationOfDelay")}>{__t(jurisdiction.delayText)}</DocCell>
          </tr>
          {jurisdiction.condonationReason ? (
            <tr>
              <DocCell label={__t("courtDocument_reasonForPrayingCondonationOfDelay")} span={3}>
                {jurisdiction.condonationReason}
              </DocCell>
            </tr>
          ) : null}
        </tbody>
      </DocTable>

      <DocSub>{<__LocalizedText id="courtDocument_24AdrPrayerAndOtherDetails" />}</DocSub>
      <DocTable>
        <tbody>
          <tr>
            <DocCell
              label={__t("courtDocument_isTheComplainantWillingToSettleThe")}
              span={3}
            >
              {adrLabel(draft)}
            </DocCell>
          </tr>
        </tbody>
      </DocTable>
      <p className="mt-4 text-body-compact font-semibold">{<__LocalizedText id="courtDocument_anyAdditionalDetails" />}</p>
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
      <p className="mt-4 text-body-compact font-semibold">{<__LocalizedText id="courtDocument_interimRelief" />}</p>
      {interimRelief.length ? (
        interimRelief.map((p, i) => <DocP key={i}>{p}</DocP>)
      ) : (
        <DocP className="text-paper-muted-foreground">{NOT_PROVIDED}</DocP>
      )}
      <p className="mt-4 text-body-compact font-semibold">{<__LocalizedText id="courtDocument_finalRelief" />}</p>
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
      <DocSection>{<__LocalizedText id="courtDocument_3Evidence" />}</DocSection>

      <DocSub>{<__LocalizedText id="courtDocument_31ListOfWitnesses" />}</DocSub>
      <DocTable>
        <tbody>
          {witnesses.map((w) => (
            <React.Fragment key={w.key}>
              <DocGroupRow>{__t(w.label)}</DocGroupRow>
              <tr>
                <DocCell label={w.term === "Designation" ? __t("courtDocument_designation") : __t("courtDocument_fullName")}>
                  {w.name}
                </DocCell>
                <DocCell label={__t("courtDocument_whatWillThisWitnessProve")} span={2}>
                  {w.prove}
                </DocCell>
              </tr>
              <tr>
                <DocCell label={__t("courtDocument_mobileNumber")}>{w.mobile}</DocCell>
                <DocCell label={__t("courtDocument_emailId")}>{w.email}</DocCell>
                <DocCell label={__t("courtDocument_address")}>{w.address}</DocCell>
              </tr>
            </React.Fragment>
          ))}
        </tbody>
      </DocTable>

      <DocSub>{<__LocalizedText id="courtDocument_32ListOfDocuments" />}</DocSub>
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
                {<__LocalizedText id="courtDocument_sNo" />}{" "}</th>
              <th className="border border-paper-border bg-paper-muted px-3 py-2 text-left text-body-compact font-semibold text-paper-muted-foreground">
                {<__LocalizedText id="courtDocument_documentName" />}{" "}</th>
              <th className="border border-paper-border bg-paper-muted px-3 py-2 text-left text-body-compact font-semibold text-paper-muted-foreground">
                {<__LocalizedText id="courtDocument_nativelyDigital" />}{" "}</th>
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
                  <DocCell>{d.digital ? __t("courtDocument_yes") : __t("courtDocument_no")}</DocCell>
                </tr>
              ))
            ) : (
              <tr>
                <DocCell span={3}>{<__LocalizedText id="courtDocument_noDocumentsHaveBeenUploadedYet" />}</DocCell>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <DocP>
        {<__LocalizedText id="courtDocument_signedOn" />}{" "}{jurisdiction.filingDateIso ? toLongDate(jurisdiction.filingDateIso) : "__"}{<__LocalizedText id="courtDocument_pleaseSeePageForTheSignatures" />}{" "}</DocP>

      {/* ── 4. Affidavit ── */}
      <DocSection>{<__LocalizedText id="courtDocument_4Affidavit" />}</DocSection>
      {/*
        The same text the Affidavit step shows and the filer may have edited — rendered
        from one expression rather than regenerated here, because a sworn document that
        disagrees with the form it came from is the worst outcome available.
      */}
      <div
        className="flex flex-col gap-3 [&_p]:text-body-compact [&_p]:leading-relaxed"
        dangerouslySetInnerHTML={{ __html: affidavitBody(draft) }}
      />

      <h4 className="mt-8 text-body-compact font-semibold">{<__LocalizedText id="courtDocument_complainant_4b427c96" />}</h4>
      <DocP>
        {<__LocalizedText id="courtDocument_iConfirmThatIHaveReadAnd" />}{" "}<br />
        {<__LocalizedText id="courtDocument_1Complaint" />}{" "}<br />
        {<__LocalizedText id="courtDocument_2AffidavitOfFact" />}{" "}</DocP>
      <h4 className="mt-6 text-body-compact font-semibold">{<__LocalizedText id="courtDocument_advocate" />}</h4>
      <DocP>
        {<__LocalizedText id="courtDocument_iConfirmTheIdentityOfTheParty" />}{" "}</DocP>
      <DocP>
        {<__LocalizedText id="courtDocument_iConfirmThatTheComplaintHasBeen" />}{" "}</DocP>
      <DocP className="text-center">***</DocP>
      <DocP className="text-paper-muted-foreground">
        {<__LocalizedText id="courtDocument_pleaseTurnOverThePageToSee" />}{" "}</DocP>
    </Card>
  );
}
