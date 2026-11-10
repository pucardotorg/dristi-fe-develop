"use client";
import {useTranslations as __useTranslations} from "@/i18n/use-translations";
import {LocalizedText as __LocalizedText} from "@/components/localized-text";

/**
 * Jurisdiction & limitation — reference implementation for a filing section.
 *
 * Everything a section needs is here: page header, cards of fields, segmented yes/no, a
 * live IFSC lookup, repeat rows, dates, a computed read-only value, and the footer wired
 * to the walk order. Police stations are searched against the station list rather than
 * typed from memory, and an unlisted one is still accepted.
 */

import Link from "next/link";
import { PlusIcon } from "lucide-react";

import { toLongDate } from "@/lib/filing/format";
import { useCourt } from "@/components/court/court-provider";
import { policeStationsFor } from "@/lib/filing/options";
import { limitationView, noticeServiceDate } from "@/lib/filing/selectors";
import { neighbours } from "@/lib/filing/steps";
import { useFiling } from "@/lib/filing/store";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { DateField } from "@/components/filing/date-field";
import { FilingFooter } from "@/components/filing/filing-footer";
import { FilingPageHeader } from "@/components/filing/filing-page-header";
import { FilingMain } from "@/components/filing/filing-shell";
import { FormCard, FormRow, FormSubhead, HalfWidth } from "@/components/filing/form-card";
import { FormField } from "@/components/filing/form-field";
import { IfscField } from "@/components/filing/ifsc-field";
import { ComboField, TextField } from "@/components/filing/inputs";
import { SectionNotice } from "@/components/filing/notices";
import { RemoveButton } from "@/components/filing/repeat-lists";
import { YesNoSegmented } from "@/components/filing/segmented";

export function JurisdictionSection() {
  const __t = __useTranslations();
  const stations = policeStationsFor(useCourt().court);
  const { draft, update, hrefFor } = useFiling();
  const j = draft.jurisdiction;
  const { prev, next } = neighbours("jurisdiction");

  const set = <K extends keyof typeof j>(key: K, value: (typeof j)[K]) =>
    update((d) => {
      d.jurisdiction[key] = value;
    });

  /** Retyping the code invalidates whatever the last lookup filled from it. */
  const editIfsc = (value: string) =>
    update((d) => {
      d.jurisdiction.ifsc = value;
      d.jurisdiction.payeeFetched = false;
    });

  const limitation = limitationView(draft);
  /** Clears a typed cause date, so it follows the demand notice again. */
  const noticeDateButton = (
    <button
      type="button"
      onClick={() => set("causeDate", "")}
      className="font-medium text-foreground underline underline-offset-2"
    >
      {<__LocalizedText id="jurisdictionSection_useThatDate" />}{" "}</button>
  );
  const { elapsed: delay, withinLimit, overBy } = limitation;
  // Shown in the derivation line, so the date it counts from is checkable.
  const serviceDate = draft.notices
    .map(noticeServiceDate)
    .filter(Boolean)
    .sort()[0] ?? "";

  return (
    <>
      <FilingMain>
        <FilingPageHeader
          title={__t("jurisdictionSection_jurisdictionLimitation")}
          description={__t("jurisdictionSection_establishWhichCourtCanHearTheCase")}
        />

        {/* Cheque presentation */}
        <FormCard
          title={__t("jurisdictionSection_chequePresentation")}
          description={__t("jurisdictionSection_whereTheChequeWasPresentedDecidesWhich")}
        >
          <FormField
            asGroup
            name="deposited"
            label={__t("jurisdictionSection_didThePayeeComplainantDepositTheCheque")}
            tip="If the payee deposited it, jurisdiction follows the payee's collecting bank branch."
          >
            <YesNoSegmented
              value={j.deposited}
              onValueChange={(v) => set("deposited", v)}
              ariaLabel="Did the payee deposit the cheque in their bank account?"
            />
          </FormField>

          <SectionNotice variant="info">
            {<__LocalizedText id="jurisdictionSection_jurisdictionFollowsTheBranchWhereTheCheque" />}{" "}</SectionNotice>

          {j.deposited === "yes" ? (
            <>
              <FormSubhead>{<__LocalizedText id="jurisdictionSection_payeeComplainantBankDetails" />}</FormSubhead>
              <IfscField
                value={j.ifsc}
                onChange={editIfsc}
                onFetched={(hit) =>
                  update((d) => {
                    d.jurisdiction.ifsc = hit.ifsc;
                    d.jurisdiction.payeeBankName = hit.bank;
                    d.jurisdiction.payeeBankBranch = hit.branch;
                    d.jurisdiction.payeeFetched = true;
                  })
                }
                fetched={j.payeeFetched}
                tip="The 11-character code of the complainant's collecting branch. Fetch to auto-fill the bank name and branch."
                placeholder={__t("jurisdictionSection_eGHdfc0000512")}
              />
              {/* Typed, not read-only: a code the registry doesn't know still has to be filed. */}
              <FormRow>
                <FormField label={__t("jurisdictionSection_bankName")} name="payeeBankName" required>
                  <TextField
                    value={j.payeeBankName}
                    onChange={(v) => set("payeeBankName", v)}
                    placeholder={__t("jurisdictionSection_complainantSBank")}
                  />
                </FormField>
                <FormField label={__t("jurisdictionSection_bankBranch")} name="payeeBankBranch" required>
                  <TextField
                    value={j.payeeBankBranch}
                    onChange={(v) => set("payeeBankBranch", v)}
                    placeholder={__t("jurisdictionSection_branchName")}
                  />
                </FormField>
              </FormRow>
              <HalfWidth>
                <FormField label={__t("jurisdictionSection_policeStationOfBankBranch")} name="payeePolice" required>
                  <ComboField
                    value={j.payeePolice}
                    onChange={(v: string) => set("payeePolice", v)}
                    items={stations}
                    placeholder={__t("jurisdictionSection_searchStations")}
                    emptyLabel={__t("jurisdictionSection_noStationByThatName")}
                    ariaLabel="Police station of bank branch"
                  />
                </FormField>
              </HalfWidth>
            </>
          ) : (
            <HalfWidth>
              <FormField label={__t("jurisdictionSection_policeStationOfDrawerAccusedBankBranch")} name="drawerPolice" required>
                <ComboField
                  value={j.drawerPolice}
                  onChange={(v: string) => set("drawerPolice", v)}
                  items={stations}
                  placeholder={__t("jurisdictionSection_searchStations")}
                  emptyLabel={__t("jurisdictionSection_noStationByThatName")}
                  ariaLabel="Police station of drawer (accused) bank branch"
                />
              </FormField>
            </HalfWidth>
          )}
        </FormCard>

        {/* Other complaints between the same parties */}
        <FormCard title={__t("jurisdictionSection_otherChequeDishonourComplaintsBetweenTheSame")}>
          <FormField
            asGroup
            name="otherPending"
            label={__t("jurisdictionSection_isThereAnyOtherChequeDishonourComplaint")}
          >
            <YesNoSegmented
              value={j.otherPending}
              onValueChange={(v) => set("otherPending", v)}
              ariaLabel="Any other cheque dishonour complaint pending between the same parties?"
            />
          </FormField>

          {j.otherPending === "yes" ? (
            <>
              <SectionNotice variant="neutral">
                {<__LocalizedText id="jurisdictionSection_listEachOneTheCourtAndThe" />}{" "}</SectionNotice>
              <div className="flex flex-col gap-4">
                {j.otherCases.map((oc, i) => (
                  <div key={i} className="flex items-end gap-3">
                    <FormRow className="flex-1">
                      <FormField label={__t("jurisdictionSection_court")} required>
                        <TextField
                          value={oc.court}
                          onChange={(v) =>
                            update((d) => {
                              d.jurisdiction.otherCases[i].court = v;
                            })
                          }
                          placeholder={__t("jurisdictionSection_eGJmfcIi")}
                        />
                      </FormField>
                      <FormField label={__t("jurisdictionSection_caseNumber")} required>
                        <TextField
                          value={oc.caseNumber}
                          onChange={(v) =>
                            update((d) => {
                              d.jurisdiction.otherCases[i].caseNumber = v;
                            })
                          }
                          placeholder={__t("jurisdictionSection_eGCc4822025")}
                        />
                      </FormField>
                    </FormRow>
                    {j.otherCases.length > 1 ? (
                      <RemoveButton
                        label={__t("jurisdictionSection_removeCaseValue0", {value0: String(i + 1)})}
                        onClick={() =>
                          update((d) => {
                            d.jurisdiction.otherCases.splice(i, 1);
                          })
                        }
                      />
                    ) : null}
                  </div>
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                className="w-fit"
                onClick={() =>
                  update((d) => {
                    d.jurisdiction.otherCases.push({ court: "", caseNumber: "" });
                  })
                }
              >
                <PlusIcon data-icon="inline-start" aria-hidden />
                {<__LocalizedText id="jurisdictionSection_addMore" />}{" "}</Button>
            </>
          ) : null}
        </FormCard>

        {/* Limitation period */}
        <FormCard
          title={__t("jurisdictionSection_limitationPeriod")}
          description={__t("jurisdictionSection_theComplaintMustBeFiledWithinOne")}
        >
          {/*
            Neither of these is really a question. The cause of action is fifteen days
            after the demand notice was served, and the filing date is today — both follow
            from what the form already knows, so they are filled in and the working is
            shown. They stay editable because the derivation cannot cover every case, and
            an edit sticks: once typed, the date is the filer's and stops following.
          */}
          <FormRow>
            <FormField
              label={__t("jurisdictionSection_dateOfCauseOfAction")}
              name="causeDate"
              required
              error={
                limitation.causeIssue ? (
                  <>
                    {limitation.causeIssue} {noticeDateButton}
                  </>
                ) : undefined
              }
              help={
                limitation.causeDerived ? (
                  `15 days after the demand notice was served on ${toLongDate(serviceDate)}.`
                ) : limitation.derivedCause &&
                  limitation.derivedCause !== limitation.causeDate &&
                  !limitation.causeIssue ? (
                  // A typed date stops following the notice; say what the notice gives,
                  // and let the filer go back to it in one step.
                  <>
                    {<__LocalizedText id="jurisdictionSection_theDemandNoticeGives" />}{" "}{toLongDate(limitation.derivedCause)}.{" "}
                    {noticeDateButton}
                  </>
                ) : undefined
              }
            >
              <DateField
                value={limitation.causeDate}
                onChange={(v) => set("causeDate", v)}
              />
            </FormField>
            <FormField
              label={__t("jurisdictionSection_dateOfComplaintFiling")}
              name="filingDate"
              error={limitation.filingIssue}
              help={j.filingDate ? undefined : "Today."}
            >
              <DateField
                value={limitation.filingDate}
                onChange={(v) => set("filingDate", v)}
              />
            </FormField>
          </FormRow>

          {/* Nothing to derive from yet — said once, where the empty field is. */}
          {limitation.causeDate ? null : (
            <SectionNotice variant="neutral">
              {<__LocalizedText id="jurisdictionSection_theCauseOfActionIsWorkedOut" />}{" "}
              <Link
                href={hrefFor("demand-notice")}
                className="font-medium text-current underline underline-offset-2"
              >
                {<__LocalizedText id="jurisdictionSection_demandNoticeDebt" />}{" "}</Link>
              .
            </SectionNotice>
          )}
          {/*
            The delay was a key-value row with a caption under it explaining that it was
            calculated — three lines of furniture around one number. It is a result, so it
            reports itself, and it reports the only thing that turns on it: whether the
            court has to be asked to condone anything.
          */}
          {delay === null ? null : withinLimit ? (
            <SectionNotice variant="success" announce="polite">
              {<__LocalizedText id="jurisdictionSection_withinTheLimitationPeriodFiled" />}{" "}{delay} {<__LocalizedText id="jurisdictionSection_day" />}{delay === 1 ? "" : "s"}{" "}
              {<__LocalizedText id="jurisdictionSection_afterTheCauseOfActionArose" />}{" "}</SectionNotice>
          ) : (
            <SectionNotice
              variant="warning"
              announce="polite"
              title={`${overBy} day${overBy === 1 ? "" : "s"} beyond the one-month limit`}
            >
              {<__LocalizedText id="jurisdictionSection_theCourtCanStillTakeThisOn" />}{" "}</SectionNotice>
          )}

          {/* Only asked for when there is a delay to condone. */}
          {withinLimit || delay === null ? null : (
            <FormField label={__t("jurisdictionSection_reasonForCondonationOfDelay")} name="condonationReason" required>
              <Textarea
                value={j.condonationReason}
                onChange={(e) => set("condonationReason", e.target.value)}
                placeholder={__t("jurisdictionSection_eGTheComplainantWasHospitalisedBetween")}
                rows={4}
              />
            </FormField>
          )}
        </FormCard>
      </FilingMain>

      <FilingFooter
        backHref={prev ? hrefFor(prev) : undefined}
        continueHref={next ? hrefFor(next) : undefined}
      />
    </>
  );
}
