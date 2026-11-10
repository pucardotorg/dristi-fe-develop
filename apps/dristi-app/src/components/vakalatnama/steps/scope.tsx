"use client";
import {useTranslations as __useTranslations} from "@/i18n/use-translations";
import {LocalizedText as __LocalizedText} from "@/components/localized-text";

/** S3 — what the appointment covers, and the editable terms (§4a). */

import * as React from "react";
import { ChevronDownIcon, PlusIcon, RotateCcwIcon, Trash2Icon } from "lucide-react";

import { FormCard } from "@/components/filing/form-card";
import { FormField } from "@/components/filing/form-field";
import { TextField, OptionSelect, ComboField } from "@/components/filing/inputs";
import { Segmented } from "@/components/filing/segmented";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { CheckCircle2Icon, InfoIcon } from "lucide-react";
import { updateVak } from "@/lib/vakalatnama/store";
import { COURTS, LITIGANT_CASES, STANDARD_TERMS, configFor, type FiledCase } from "@/lib/vakalatnama/data";
import type { Scope, Terms, Vakalatnama } from "@/lib/vakalatnama/types";
import { Identifier } from "@/components/chrome/identifier";
import { useCourtText } from "@/components/court/court-provider";

export function ScopeStep({ vak }: { vak: Vakalatnama }) {
  const __t = __useTranslations();
  const courtText = useCourtText();
  const setScope = (patch: Partial<Scope>) =>
    updateVak(vak.id, (p) => ({ ...p, scope: { ...p.scope, ...patch } }));
  const setTerms = (t: Terms) => updateVak(vak.id, (p) => ({ ...p, terms: t }));

  const config = configFor(vak.scope.court);
  const s = vak.scope;
  const [caseQuery, setCaseQuery] = React.useState(s.caseNumber);

  const scopeOptions = [
    { value: "specific", label: __t("scope_aSpecificCase") },
    ...(config.standingEnabled ? [{ value: "standing", label: __t("scope_allCasesStanding") }] : []),
  ];

  return (
    <div className="flex flex-col gap-6">
      <FormCard title={__t("scope_court")} description={__t("scope_whichCourtThisAppointmentIsFor")}>
        <FormField label={__t("scope_court")} asGroup>
          <OptionSelect
            value={s.court}
            onValueChange={(v) => setScope({ court: v })}
            options={COURTS.map((court) => ({ value: court, label: courtText(court) }))}
            placeholder={__t("scope_selectTheCourt")}
            ariaLabel="Court"
          />
        </FormField>
      </FormCard>

      <FormCard
        title={__t("scope_whatDoesThisVakalatnamaCover")}
        description={__t("scope_oneCaseOrAStandingAppointmentAcross")}
      >
        <FormField label={__t("scope_scope")} asGroup>
          <Segmented
            size="compact"
            value={s.type}
            onValueChange={(v) => setScope({ type: v as Scope["type"] })}
            options={scopeOptions}
            ariaLabel="Scope"
          />
        </FormField>

        {s.type === "specific" ? (
          <>
            <FormField label={__t("scope_isTheCaseAlreadyFiled")} asGroup>
              <Segmented
                size="compact"
                value={s.caseState}
                onValueChange={(v) => setScope({ caseState: v as Scope["caseState"] })}
                options={[
                  { value: "filed", label: __t("scope_alreadyFiled") },
                  { value: "not_filed", label: __t("scope_notYetFiled") },
                ]}
                ariaLabel="Case state"
              />
            </FormField>

            {s.caseState === "filed" ? (
              <>
                <FormField
                  label={__t("scope_findYourCase")}
                  asGroup
                  help="Search the cases you’re already a party to."
                >
                  <ComboField
                    value={caseQuery}
                    onChange={setCaseQuery}
                    items={LITIGANT_CASES}
                    itemKey={(c) => (c as FiledCase).caseNumber}
                    itemLabel={(c) => (c as FiledCase).caseNumber}
                    renderItem={(c) => {
                      const fc = c as FiledCase;
                      return (
                        <div className="flex w-full flex-col">
                          {/* A combobox row is an option — no control nested inside it. */}
                          <Identifier
                            value={fc.caseNumber}
                            label={__t("scope_caseNumber")}
                            className="text-body-compact"
                            copyable={false}
                          />
                          <span className="text-caption text-muted-foreground">
                            {__t(fc.title)} · {courtText(fc.court)}
                          </span>
                        </div>
                      );
                    }}
                    onSelect={(c) => {
                      const fc = c as FiledCase;
                      setScope({ caseNumber: fc.caseNumber, court: fc.court });
                      setCaseQuery(fc.caseNumber);
                    }}
                    placeholder={__t("scope_searchByCaseNumberOrParty")}
                    emptyLabel={__t("scope_noMatchingCaseFound")}
                    ariaLabel="Search your cases"
                  />
                </FormField>

                {s.caseNumber ? (
                  <div className="flex items-center gap-3 rounded-lg bg-surface-sunken p-3">
                    <CheckCircle2Icon aria-hidden className="size-5 shrink-0 text-success-ink" />
                    <div className="flex min-w-0 flex-col">
                      <Identifier
                        value={s.caseNumber}
                        label={__t("scope_caseNumber")}
                        className="self-start text-body-compact"
                      />
                      <span className="text-caption text-muted-foreground">
                        {__t(LITIGANT_CASES.find((c) => c.caseNumber === s.caseNumber)?.title) ??
                          __t("scope_selectedCase")}
                      </span>
                    </div>
                  </div>
                ) : null}
              </>
            ) : (
              <>
                <FormField
                  label={__t("scope_linkADraftFiling")}
                  optional
                  help="Attach this to a draft you’re preparing, or note the matter. The case number is filled in when it’s registered."
                >
                  <TextField
                    value={s.draftRef}
                    onChange={(v) => setScope({ draftRef: v })}
                    placeholder={__t("scope_draftReferenceOrAShortNote")}
                    className="max-w-md"
                  />
                </FormField>
                <Alert>
                  <InfoIcon aria-hidden />
                  <AlertTitle>{<__LocalizedText id="scope_theCaseNumberStaysBlankForNow" />}</AlertTitle>
                  <AlertDescription>
                    {<__LocalizedText id="scope_likeThePaperFormThisVakalatnamaCan" />}{" "}</AlertDescription>
                </Alert>
              </>
            )}
          </>
        ) : (
          <Alert>
            <InfoIcon aria-hidden />
            <AlertTitle>{<__LocalizedText id="scope_aStandingAppointment" />}</AlertTitle>
            <AlertDescription>
              {<__LocalizedText id="scope_thisCoversAllOfTheLitigantS" />}{" "}</AlertDescription>
          </Alert>
        )}
      </FormCard>

      <TermsPanel terms={vak.terms} onChange={setTerms} />
    </div>
  );
}

/** The granted-powers block — standard by default, collapsed, editable on request. */
function TermsPanel({ terms, onChange }: { terms: Terms; onChange: (t: Terms) => void }) {
  const __t = __useTranslations();
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState(false);

  const setClause = (i: number, text: string) => {
    const clauses = terms.clauses.map((c, idx) => (idx === i ? text : c));
    onChange({ source: "edited", clauses });
  };
  const removeClause = (i: number) =>
    onChange({ source: "edited", clauses: terms.clauses.filter((_, idx) => idx !== i) });
  const addClause = () => onChange({ source: "edited", clauses: [...terms.clauses, ""] });
  const reset = () => {
    onChange({ source: "standard", clauses: [...STANDARD_TERMS] });
    setEditing(false);
  };

  return (
    <FormCard
      title={__t("scope_termsThePowersYouGrant")}
      description={__t("scope_standardByDefaultOpenToReadThem")}
      action={
        terms.source === "edited" ? (
          <span className="text-caption font-medium text-warning-ink">{<__LocalizedText id="scope_edited" />}</span>
        ) : (
          <span className="text-caption text-muted-foreground">{<__LocalizedText id="scope_standard" />}</span>
        )
      }
    >
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <Button type="button" variant="outline" className="w-fit">
            <ChevronDownIcon
              aria-hidden
              className={open ? "rotate-180 transition-transform" : "transition-transform"}
            />
            {open ? __t("scope_hideTerms") : __t("scope_viewTerms")}
          </Button>
        </CollapsibleTrigger>

        <CollapsibleContent className="mt-4 flex flex-col gap-4">
          {!editing ? (
            <>
              <ol className="flex list-decimal flex-col gap-2 rounded-lg bg-surface-sunken p-4 pl-9 text-body-compact">
                {terms.clauses.map((c, i) => (
                  <li key={i} className="pl-1 leading-relaxed">
                    {c || <span className="text-muted-foreground">{<__LocalizedText id="scope_emptyClause" />}</span>}
                  </li>
                ))}
              </ol>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={() => setEditing(true)}>
                  {<__LocalizedText id="scope_editTerms" />}{" "}</Button>
                {terms.source === "edited" ? (
                  <Button type="button" variant="ghost" onClick={reset}>
                    <RotateCcwIcon aria-hidden />
                    {<__LocalizedText id="scope_resetToStandard" />}{" "}</Button>
                ) : null}
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-4">
              {terms.clauses.map((c, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="mt-2.5 w-5 shrink-0 text-right text-caption tabular-nums text-muted-foreground">
                    {i + 1}.
                  </span>
                  <Textarea
                    value={c}
                    onChange={(ev) => setClause(i, ev.target.value)}
                    rows={2}
                    className="flex-1"
                    aria-label={__t("scope_clauseValue0", {value0: String(i + 1)})}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={__t("scope_removeClauseValue0", {value0: String(i + 1)})}
                    onClick={() => removeClause(i)}
                    className="text-muted-foreground"
                  >
                    <Trash2Icon aria-hidden />
                  </Button>
                </div>
              ))}
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={addClause}>
                  <PlusIcon aria-hidden />
                  {<__LocalizedText id="scope_addAClause" />}{" "}</Button>
                <Button type="button" variant="ghost" onClick={reset}>
                  <RotateCcwIcon aria-hidden />
                  {<__LocalizedText id="scope_resetToStandard" />}{" "}</Button>
                <Button type="button" onClick={() => setEditing(false)}>
                  {<__LocalizedText id="scope_doneEditing" />}{" "}</Button>
              </div>
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>
    </FormCard>
  );
}
