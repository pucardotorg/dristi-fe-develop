"use client";

/**
 * S4 — the witness (#4). A witness is optional. If added, it is a registered notary
 * (searched in the registry) or any other person (whose details are collected).
 */

import * as React from "react";
import { CheckCircle2Icon } from "lucide-react";

import { FormCard, FormRow } from "@/components/filing/form-card";
import { FormField } from "@/components/filing/form-field";
import { TextField, MobileInput, ComboField } from "@/components/filing/inputs";
import { Segmented } from "@/components/filing/segmented";
import { AddressFields } from "@/components/filing/address-fields";
import { IdUpload } from "@/components/vakalatnama/id-upload";
import { updateVak } from "@/lib/vakalatnama/store";
import { NOTARY_REGISTRY, type Notary } from "@/lib/vakalatnama/data";
import type { Address, Attestation, Vakalatnama, WitnessKind } from "@/lib/vakalatnama/types";
import { Identifier } from "@/components/chrome/identifier";
import { useTranslations } from "next-intl";

export function AttestationStep({ vak }: { vak: Vakalatnama }) {
  const t = useTranslations();
  const a = vak.attestation;
  const set = (patch: Partial<Attestation>) =>
    updateVak(vak.id, (p) => ({ ...p, attestation: { ...p.attestation, ...patch } }));
  const setAddress = (addr: Address) => set({ address: addr });

  const [notaryQuery, setNotaryQuery] = React.useState(a.name);

  return (
    <div className="flex flex-col gap-6">
      <FormCard
        title={t("attestation_addAWitness")}
        description={t("attestation_aWitnessConfirmsTheSigningIts")}
      >
        <FormField label={t("attestation_witness")} asGroup>
          <Segmented
            size="compact"
            value={a.hasWitness ? "yes" : "no"}
            onValueChange={(v) => set({ hasWitness: v === "yes" })}
            options={[
              { value: "no", label: t("attestation_noWitness") },
              { value: "yes", label: t("attestation_addAWitnessLabel") },
            ]}
            ariaLabel={t("attestation_addAWitnessLabel")}
          />
        </FormField>
      </FormCard>

      {a.hasWitness ? (
        <FormCard title={t("attestation_witnessDetails")}>
          <FormField label={t("attestation_typeOfWitness")} asGroup>
            <Segmented
              size="compact"
              value={a.kind}
              onValueChange={(v) => set({ kind: v as WitnessKind })}
              options={[
                { value: "notary", label: t("attestation_registeredNotary") },
                { value: "other", label: t("attestation_other") },
              ]}
              ariaLabel={t("attestation_typeOfWitness")}
            />
          </FormField>

          {a.kind === "notary" ? (
            <>
              <FormField
                label={t("attestation_findTheNotary")}
                asGroup
                help={t("attestation_searchTheRegisteredNotaries")}
              >
                <ComboField
                  value={notaryQuery}
                  onChange={setNotaryQuery}
                  items={NOTARY_REGISTRY}
                  itemKey={(n) => (n as Notary).registration}
                  itemLabel={(n) => (n as Notary).name}
                  renderItem={(n) => {
                    const nt = n as Notary;
                    return (
                      <div className="flex w-full flex-col">
                        <span className="text-body-compact">{nt.name}</span>
                        <span className="text-caption text-muted-foreground">
                          {/* A combobox row is an option — no control nested inside it. */}
                          <Identifier
                            value={nt.registration}
                            label={t("attestation_registrationNumber")}
                            copyable={false}
                          />
                          <span aria-hidden> · </span>
                          {nt.place}
                        </span>
                      </div>
                    );
                  }}
                  onSelect={(n) => {
                    const nt = n as Notary;
                    set({ name: nt.name, registration: nt.registration });
                    setNotaryQuery(nt.name);
                  }}
                  placeholder={t("attestation_searchByNameOrRegistrationNumber")}
                  emptyLabel={t("attestation_noMatchingNotaryFound")}
                  ariaLabel={t("attestation_searchRegisteredNotaries")}
                />
              </FormField>

              {a.registration ? (
                <div className="flex items-center gap-3 rounded-lg bg-surface-sunken p-3">
                  <CheckCircle2Icon aria-hidden className="size-5 shrink-0 text-success-ink" />
                  <div className="flex min-w-0 flex-col">
                    <span className="text-body-compact">{a.name}</span>
                    <Identifier
                      value={a.registration}
                      label={t("attestation_registrationNumber")}
                      className="self-start text-caption text-muted-foreground"
                    />
                  </div>
                </div>
              ) : null}
            </>
          ) : (
            <>
              <FormRow>
                <FormField label={t("attestation_name")} required>
                  <TextField
                    value={a.name}
                    onChange={(v) => set({ name: v })}
                    placeholder={t("attestation_witnesssFullName")}
                    autoComplete="name"
                  />
                </FormField>
                <FormField
                  label={t("attestation_relation")}
                  required
                  help={t("attestation_howTheyKnowTheParty")}
                >
                  <TextField
                    value={a.relation}
                    onChange={(v) => set({ relation: v })}
                    placeholder={t("attestation_eGColleagueNeighbour")}
                  />
                </FormField>
              </FormRow>

              <FormField label={t("attestation_mobileNumber")} required>
                <MobileInput
                  value={a.mobile}
                  onChange={(v) => set({ mobile: v })}
                  placeholder="10-digit mobile"
                  className="max-w-xs"
                />
              </FormField>

              <FormField
                label={t("attestation_idCard")}
                required
                help={t("attestation_proofOfTheWitnesssIdentity")}
              >
                <IdUpload value={a.idDoc} onChange={(v) => set({ idDoc: v })} />
              </FormField>

              <div className="flex flex-col gap-2">
                <span className="text-body-compact font-medium">{t("attestation_address")}</span>
                <AddressFields value={a.address} onChange={setAddress} idPrefix="vak-witness" />
              </div>
            </>
          )}
        </FormCard>
      ) : null}
    </div>
  );
}
