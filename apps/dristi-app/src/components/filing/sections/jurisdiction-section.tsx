"use client";

/**
 * Jurisdiction & limitation — reference implementation for a filing section.
 *
 * Everything a section needs is here: page header, cards of fields, segmented yes/no, a
 * live IFSC lookup, repeat rows, dates, a computed read-only value, and the footer wired
 * to the walk order. Police stations are searched against the station list rather than
 * typed from memory, and an unlisted one is still accepted.
 */

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PlusIcon } from "lucide-react";

import { jurisdictionCopy } from "@/lib/filing/content";
import { jurisdictionDetails } from "@/lib/filing/details";
import { toLongDate } from "@/lib/filing/format";
import { useCourt } from "@/components/court/court-provider";
import { policeStationsFor } from "@/lib/filing/options";
import { limitationView, noticeServiceDate } from "@/lib/filing/selectors";
import { neighbours } from "@/lib/filing/steps";
import { useFiling } from "@/lib/filing/store";
import { useDetailsSection } from "@/lib/filing/use-details-section";
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
import { useTranslations } from "next-intl";

export function JurisdictionSection() {
  const t = useTranslations();
  const stations = policeStationsFor(useCourt().court);
  const { draft, update, hrefFor } = useFiling();
  const j = draft.jurisdiction;
  const { prev, next } = neighbours("jurisdiction");
  const router = useRouter();
  const { save, saving, error } = useDetailsSection("jurisdiction_limitation", jurisdictionDetails);

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
      {t("jurisdictionSection_useThatDate")}
    </button>
  );
  const { elapsed: delay, withinLimit, overBy } = limitation;
  /* The verdict that was already there on arrival stands still; a new one plays. */
  const [verdictOnOpen] = React.useState(delay === null ? null : withinLimit);
  const verdictStill = delay !== null && verdictOnOpen === withinLimit;
  // Shown in the derivation line, so the date it counts from is checkable.
  const serviceDate = draft.notices.map(noticeServiceDate).filter(Boolean).sort()[0] ?? "";

  // A late filing needs a condonation reason, but the backend now accepts the section
  // without it and `validate` flags it before signing — so Continue no longer stops here.
  // The warning above and the hint under the field keep the missing reason visible.
  const needsReason = delay !== null && !withinLimit && !j.condonationReason.trim();

  /* Save whatever is filled to the case, then move on. A save failure keeps the filer here
     so the data loss is visible. */
  const continueHref = next ? hrefFor(next) : undefined;
  const handleContinue = async () => {
    const result = await save();
    if (result.ok && continueHref) router.push(continueHref);
  };

  return (
    <>
      <FilingMain>
        <FilingPageHeader
          title={t("jurisdictionSection_jurisdictionLimitation")}
          description={t("jurisdictionSection_establishWhichCourtCanHearThe")}
        />

        {/* Cheque presentation */}
        <FormCard
          title={t("jurisdictionSection_chequePresentation")}
          description={t("jurisdictionSection_whereTheChequeWasPresentedDecides")}
        >
          <FormField
            asGroup
            name="deposited"
            label={t("jurisdictionSection_didThePayeeComplainantDepositThe")}
            tip={t("jurisdictionSection_ifThePayeeDepositedItJurisdiction")}
          >
            <YesNoSegmented
              value={j.deposited}
              onValueChange={(v) => set("deposited", v)}
              ariaLabel={t("jurisdictionSection_didThePayeeDepositTheCheque")}
            />
          </FormField>

          <SectionNotice variant="info">
            {t("jurisdictionSection_jurisdictionFollowsTheBranchWhereThe")}
          </SectionNotice>

          {j.deposited === "yes" ? (
            <>
              <FormSubhead>{t("jurisdictionSection_payeeComplainantBankDetails")}</FormSubhead>
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
                tip={t("jurisdictionSection_the11CharacterCodeOfThe")}
                placeholder={t("jurisdictionSection_eGHdfc0000512")}
              />
              {/* Typed, not read-only: a code the registry doesn't know still has to be filed. */}
              <FormRow>
                <FormField label={t("jurisdictionSection_bankName")} name="payeeBankName" required>
                  <TextField
                    value={j.payeeBankName}
                    onChange={(v) => set("payeeBankName", v)}
                    placeholder={t("jurisdictionSection_complainantsBank")}
                  />
                </FormField>
                <FormField
                  label={t("jurisdictionSection_bankBranch")}
                  name="payeeBankBranch"
                  required
                >
                  <TextField
                    value={j.payeeBankBranch}
                    onChange={(v) => set("payeeBankBranch", v)}
                    placeholder={t("jurisdictionSection_branchName")}
                  />
                </FormField>
              </FormRow>
              <HalfWidth>
                <FormField
                  label={t("jurisdictionSection_policeStationOfBankBranch")}
                  name="payeePolice"
                  required
                >
                  <ComboField
                    value={j.payeePolice}
                    onChange={(v: string) => set("payeePolice", v)}
                    items={stations}
                    placeholder={t("jurisdictionSection_searchStations")}
                    emptyLabel={t("jurisdictionSection_noStationByThatName")}
                    ariaLabel={t("jurisdictionSection_policeStationOfBankBranch")}
                  />
                </FormField>
              </HalfWidth>
            </>
          ) : (
            <HalfWidth>
              <FormField
                label={t("jurisdictionSection_policeStationOfDrawerAccusedBank")}
                name="drawerPolice"
                required
              >
                <ComboField
                  value={j.drawerPolice}
                  onChange={(v: string) => set("drawerPolice", v)}
                  items={stations}
                  placeholder={t("jurisdictionSection_searchStations")}
                  emptyLabel={t("jurisdictionSection_noStationByThatName")}
                  ariaLabel={t("jurisdictionSection_policeStationOfDrawerAccusedBank")}
                />
              </FormField>
            </HalfWidth>
          )}
        </FormCard>

        {/* Other complaints between the same parties */}
        <FormCard title={t("jurisdictionSection_otherChequeDishonourComplaintsBetweenThe")}>
          <FormField
            asGroup
            name="otherPending"
            label={t("jurisdictionSection_isThereAnyOtherChequeDishonour")}
          >
            <YesNoSegmented
              value={j.otherPending}
              onValueChange={(v) => set("otherPending", v)}
              ariaLabel={t("jurisdictionSection_anyOtherChequeDishonourComplaintPending")}
            />
          </FormField>

          {j.otherPending === "yes" ? (
            <>
              <SectionNotice variant="neutral">
                {t("jurisdictionSection_listEachOneTheCourtAnd")}
              </SectionNotice>
              <div className="flex flex-col gap-4">
                {j.otherCases.map((oc, i) => (
                  <div key={i} className="flex items-end gap-3">
                    <FormRow className="flex-1">
                      <FormField label={t("jurisdictionSection_court")} required>
                        <TextField
                          value={oc.court}
                          onChange={(v) =>
                            update((d) => {
                              d.jurisdiction.otherCases[i].court = v;
                            })
                          }
                          placeholder={t("jurisdictionSection_eGJmfcIi")}
                        />
                      </FormField>
                      <FormField label={t("jurisdictionSection_caseNumber")} required>
                        <TextField
                          value={oc.caseNumber}
                          onChange={(v) =>
                            update((d) => {
                              d.jurisdiction.otherCases[i].caseNumber = v;
                            })
                          }
                          placeholder={t("jurisdictionSection_eGCc4822025")}
                        />
                      </FormField>
                    </FormRow>
                    {j.otherCases.length > 1 ? (
                      <RemoveButton
                        label={t("jurisdictionSection_removeCaseValue", { value: String(i + 1) })}
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
                {t("jurisdictionSection_addMore")}
              </Button>
            </>
          ) : null}
        </FormCard>

        {/* Limitation period */}
        <FormCard
          title={t("jurisdictionSection_limitationPeriod")}
          description={t("jurisdictionSection_theComplaintMustBeFiledWithin")}
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
              label={t("jurisdictionSection_dateOfCauseOfAction")}
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
                  t("jurisdictionSection_15DaysAfterTheDemandNotice", {
                    toLongDate: toLongDate(serviceDate),
                  })
                ) : limitation.derivedCause &&
                  limitation.derivedCause !== limitation.causeDate &&
                  !limitation.causeIssue ? (
                  // A typed date stops following the notice; say what the notice gives,
                  // and let the filer go back to it in one step.
                  <>
                    {t("jurisdictionSection_theDemandNoticeGivesToLong", {
                      toLongDate: toLongDate(limitation.derivedCause),
                    })}
                    {noticeDateButton}
                  </>
                ) : undefined
              }
            >
              <DateField value={limitation.causeDate} onChange={(v) => set("causeDate", v)} />
            </FormField>
            <FormField
              label={t("jurisdictionSection_dateOfComplaintFiling")}
              name="filingDate"
              error={limitation.filingIssue}
              help={j.filingDate ? undefined : t("jurisdictionSection_today")}
            >
              <DateField value={limitation.filingDate} onChange={(v) => set("filingDate", v)} />
            </FormField>
          </FormRow>

          {/* Nothing to derive from yet — said once, where the empty field is. */}
          {limitation.causeDate ? null : (
            <SectionNotice variant="neutral">
              {t.rich("jurisdictionSection_theCauseOfActionIsWorked", {
                link: (chunks) => (
                  <Link
                    href={hrefFor("demand-notice")}
                    className="font-medium text-current underline underline-offset-2"
                  >
                    {chunks}
                  </Link>
                ),
              })}
            </SectionNotice>
          )}
          {/*
            The delay was a key-value row with a caption under it explaining that it was
            calculated — three lines of furniture around one number. It is a result, so it
            reports itself, and it reports the only thing that turns on it: whether the
            court has to be asked to condone anything.
          */}
          {delay === null ? null : withinLimit ? (
            <SectionNotice variant="success" announce="polite" still={verdictStill}>
              Within the limitation period: filed {delay} day{delay === 1 ? "" : "s"} after the
              cause of action arose.
            </SectionNotice>
          ) : (
            <SectionNotice
              variant="warning"
              announce="polite"
              still={verdictStill}
              title={`${overBy} day${overBy === 1 ? "" : "s"} beyond the one-month limit`}
            >
              {t("jurisdictionSection_theCourtCanStillTakeThis")}
            </SectionNotice>
          )}

          {/* Only asked for when there is a delay to condone. */}
          {withinLimit || delay === null ? null : (
            <FormField
              label={t("jurisdictionSection_reasonForCondonationOfDelay")}
              name="condonationReason"
              required
              help={needsReason ? jurisdictionCopy.condonationMissing : undefined}
            >
              <Textarea
                value={j.condonationReason}
                onChange={(e) => set("condonationReason", e.target.value)}
                placeholder={t("jurisdictionSection_eGTheComplainantWasHospitalised")}
                rows={4}
              />
            </FormField>
          )}
        </FormCard>

        {error ? (
          <SectionNotice
            variant="destructive"
            title={t("jurisdictionSection_couldntSaveToTheCourtsServer")}
          >
            {error}
          </SectionNotice>
        ) : null}
      </FilingMain>

      <FilingFooter
        backHref={prev ? hrefFor(prev) : undefined}
        onContinue={continueHref ? handleContinue : undefined}
        continueDisabled={saving}
        continueLabel={saving ? t("jurisdictionSection_saving") : t("jurisdictionSection_continue")}
      />
    </>
  );
}
