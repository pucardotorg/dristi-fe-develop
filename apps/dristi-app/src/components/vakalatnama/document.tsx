"use client";
import {useTranslations as __useTranslations} from "@/i18n/use-translations";
import {LocalizedText as __LocalizedText} from "@/components/localized-text";

/**
 * The vakalatnama instrument, rendered from the draft — the paper as it would read. Shown
 * on Preview (before signing) and on the executed screen. Case number shows blank where
 * the matter is not yet filed, exactly as the executed form carries "C.C. No. ___".
 */

import * as React from "react";

import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { PANEL_CLASS } from "@/components/filing/form-card";
import {
  advocateNames,
  executantIntro,
  executantName,
  serviceAdvocate,
} from "@/lib/vakalatnama/format";
import type { Vakalatnama } from "@/lib/vakalatnama/types";
import { configFor } from "@/lib/vakalatnama/data";

function Line({ label, value }: { label: string; value: React.ReactNode }) {
  const __t = __useTranslations();
  return (
    <div className="flex flex-wrap items-baseline gap-x-2">
      <span className="text-caption font-medium uppercase tracking-wide text-muted-foreground">
        {__t(label)}
      </span>
      <span className="text-body-compact tabular-nums">{value}</span>
    </div>
  );
}

export function VakalatnamaDocument({
  vak,
  className,
}: {
  vak: Vakalatnama;
  className?: string;
}) {
  const __t = __useTranslations();
  const service = serviceAdvocate(vak);
  const config = configFor(vak.scope.court);
  const caseNo =
    vak.scope.type === "standing"
      ? "All cases under this appointment"
      : vak.scope.caseState === "filed"
        ? vak.scope.caseNumber.trim() || "—"
        : vak.boundCaseNumber?.trim() || "______ of " + new Date().getFullYear();

  return (
    <Card className={cn(PANEL_CLASS, "gap-8 p-8 md:p-12", className)}>
      {/* Court header */}
      <header className="flex flex-col items-center gap-1 text-center">
        <p className="text-caption font-semibold uppercase tracking-wide text-muted-foreground">
          {<__LocalizedText id="document_beforeThe" />}{" "}</p>
        <h2 className="text-title-s font-semibold">
          {vak.scope.court || config.court}
        </h2>
        <p className="text-body-compact text-muted-foreground">
          {<__LocalizedText id="document_chequeBounceSection138NegotiableInstrumentsAct" />}{" "}</p>
        <p className="mt-2 text-body-compact tabular-nums">{<__LocalizedText id="document_caseNo" />}{" "}{caseNo}</p>
        <p className="mt-4 text-title-s font-semibold tracking-tight">{<__LocalizedText id="document_vakalatnama" />}</p>
      </header>

      <div className="h-px w-full bg-hairline" />

      {/* Body */}
      <div className="flex flex-col gap-4 text-body leading-relaxed">
        <p>
          <span className="font-medium">{executantIntro(vak.executant)}</span>{<__LocalizedText id="document_doHerebyAppointAndRetain" />}{" "}
          <span className="font-medium">{advocateNames(vak)}</span>
          {vak.advocates.length > 1 ? __t("document_advocates") : __t("document_advocate")} {<__LocalizedText id="document_toAppearAndActForMeUs" />}{" "}</p>

        <ol className="flex list-decimal flex-col gap-2 pl-6 text-body-compact">
          {vak.terms.clauses.map((c, i) => (
            <li key={i} className="pl-1 leading-relaxed">
              {c}
            </li>
          ))}
        </ol>

        {vak.terms.source === "edited" ? (
          <p className="text-caption text-warning-ink">
            {<__LocalizedText id="document_theseTermsHaveBeenEditedFromThe" />}{" "}</p>
        ) : null}
      </div>

      <div className="h-px w-full bg-hairline" />

      {/* Execution block */}
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-1">
            <span className="text-caption font-medium uppercase tracking-wide text-muted-foreground">
              {<__LocalizedText id="document_executant" />}{" "}</span>
            <span className="text-body font-medium">
              {executantName(vak.executant)}
            </span>
            <span className="text-caption text-muted-foreground">
              {<__LocalizedText id="document_signatureOfTheParty" />}{" "}</span>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-caption font-medium uppercase tracking-wide text-muted-foreground">
              {<__LocalizedText id="document_iKnowTheParty" />}{" "}</span>
            <span className="text-body-compact">{service?.name || "—"}</span>
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-1">
            <span className="text-caption font-medium uppercase tracking-wide text-muted-foreground">
              {<__LocalizedText id="document_signedBeforeMeAccepted" />}{" "}</span>
            {vak.advocates.length === 0 ? (
              <span className="text-body-compact text-muted-foreground">—</span>
            ) : (
              vak.advocates.map((a) => (
                <span key={a.id} className="text-body-compact">
                  {a.name.trim() || __t("document_advocate_5a5e9655")}
                  {a.enrolmentNo ? (
                    <span className="ml-1 font-mono text-caption text-muted-foreground">
                      ({a.enrolmentNo})
                    </span>
                  ) : null}
                  {a.forService ? (
                    <span className="ml-1 text-caption text-muted-foreground">
                      {<__LocalizedText id="document_forService" />}{" "}</span>
                  ) : null}
                </span>
              ))
            )}
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-caption font-medium uppercase tracking-wide text-muted-foreground">
              {<__LocalizedText id="document_witness" />}{" "}</span>
            {vak.attestation.hasWitness ? (
              <span className="text-body-compact">
                {vak.attestation.name.trim() ||
                  (vak.attestation.kind === "notary" ? __t("document_notary_e17cc9a9") : __t("document_witness"))}
                {vak.attestation.kind === "notary" ? (
                  <span className="ml-1 text-caption text-muted-foreground">{<__LocalizedText id="document_notary" />}</span>
                ) : null}
              </span>
            ) : (
              <span className="text-body-compact text-muted-foreground">{<__LocalizedText id="document_noWitness" />}</span>
            )}
          </div>
        </div>
      </div>

      {service ? (
        <div className="rounded-lg bg-surface-sunken p-4">
          <Line label={__t("document_addressForService")} value={service.name} />
          <p className="mt-1 text-body-compact text-muted-foreground">
            {service.address.line1
              ? [
                  service.address.line1,
                  service.address.city,
                  service.address.district,
                  service.address.state,
                  service.address.pin,
                ]
                  .filter((s) => s && s.trim())
                  .join(", ")
              : __t("document_addressOnRecord")}
          </p>
        </div>
      ) : null}
    </Card>
  );
}
