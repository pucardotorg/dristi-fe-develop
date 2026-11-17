"use client";

/** S1 — the litigant the vakalatnama is from. Individual, or organisation via signatory. */

import * as React from "react";

import { FormCard, FormRow } from "@/components/filing/form-card";
import { FormField } from "@/components/filing/form-field";
import { TextField, OptionSelect, MobileInput } from "@/components/filing/inputs";
import { Segmented } from "@/components/filing/segmented";
import { AddressFields } from "@/components/filing/address-fields";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { InfoIcon } from "lucide-react";
import { IdUpload } from "@/components/vakalatnama/id-upload";
import { updateVak } from "@/lib/vakalatnama/store";
import type { Address, Executant, Vakalatnama } from "@/lib/vakalatnama/types";
import { useTranslations } from "next-intl";

const RELATIONS = ["S/o", "D/o", "W/o"];

export function ExecutantStep({ vak }: { vak: Vakalatnama }) {
  const t = useTranslations();
  const e = vak.executant;
  const set = (patch: Partial<Executant>) =>
    updateVak(vak.id, (p) => ({ ...p, executant: { ...p.executant, ...patch } }));
  const setAddress = (addr: Address) => set({ address: addr });

  return (
    <div className="flex flex-col gap-6">
      {vak.creatorRole === "litigant" ? (
        <Alert>
          <InfoIcon aria-hidden />
          <AlertTitle>{t("executant_filedAsYourself")}</AlertTitle>
          <AlertDescription>{t("executant_youAreTheLitigantOnThis")}</AlertDescription>
        </Alert>
      ) : null}

      <FormCard
        title={t("executant_whoIsAppointingTheAdvocate")}
        description={t("executant_theLitigantThisVakalatnamaIsFrom")}
      >
        <FormField label={t("executant_executant")} asGroup>
          <Segmented
            size="compact"
            value={e.kind}
            onValueChange={(v) => set({ kind: v })}
            options={[
              { value: "individual", label: t("executant_anIndividual") },
              { value: "organisation", label: t("executant_anOrganisation") },
            ]}
            ariaLabel={t("executant_executantKind")}
          />
        </FormField>

        {e.kind === "individual" ? (
          <>
            <FormRow>
              <FormField label={t("executant_fullName")} required>
                <TextField
                  value={e.name}
                  onChange={(v) => set({ name: v })}
                  placeholder={t("executant_asOnRecord")}
                  autoComplete="name"
                />
              </FormField>
              <FormField label={t("executant_age")} required>
                <TextField
                  value={e.age}
                  onChange={(v) => set({ age: v.replace(/\D/g, "").slice(0, 3) })}
                  placeholder={t("executant_years")}
                  inputMode="numeric"
                  className="max-w-32"
                />
              </FormField>
            </FormRow>
            <FormRow>
              <FormField label={t("executant_relation")} optional>
                <OptionSelect
                  value={e.relationType}
                  onValueChange={(v) => set({ relationType: v as Executant["relationType"] })}
                  options={RELATIONS}
                  placeholder={t("executant_sODOWO")}
                />
              </FormField>
              <FormField label={t("executant_relationName")} optional>
                <TextField
                  value={e.relationName}
                  onChange={(v) => set({ relationName: v })}
                  placeholder={t("executant_fatherHusbandsName")}
                />
              </FormField>
            </FormRow>
          </>
        ) : (
          <>
            <FormField label={t("executant_organisationName")} required>
              <TextField
                value={e.orgName}
                onChange={(v) => set({ orgName: v })}
                placeholder={t("executant_eGABankOrCompany")}
              />
            </FormField>
            <FormRow>
              <FormField
                label={t("executant_authorisedSignatory")}
                required
                help={t("executant_thePersonWhoSignsForThe")}
              >
                <TextField
                  value={e.signatoryName}
                  onChange={(v) => set({ signatoryName: v })}
                  placeholder={t("executant_name")}
                  autoComplete="name"
                />
              </FormField>
              <FormField label={t("executant_designation")} optional>
                <TextField
                  value={e.signatoryDesignation}
                  onChange={(v) => set({ signatoryDesignation: v })}
                  placeholder={t("executant_eGManager")}
                />
              </FormField>
            </FormRow>
          </>
        )}

        <FormRow>
          <FormField
            label={t("executant_mobileNumber")}
            required
            help={t("executant_theSigningOtpIsSentTo")}
          >
            <MobileInput
              value={e.mobile}
              onChange={(v) => set({ mobile: v })}
              placeholder="10-digit mobile"
            />
          </FormField>
          <FormField
            label={t("executant_idCard")}
            required
            help={t("executant_proofOfIdentityForTheSigner")}
          >
            <IdUpload value={e.idDoc} onChange={(v) => set({ idDoc: v })} />
          </FormField>
        </FormRow>
      </FormCard>

      <FormCard
        title={t("executant_address")}
        description={t("executant_theLitigantsAddressForTheRecord")}
      >
        <AddressFields value={e.address} onChange={setAddress} idPrefix="vak-exec" />
      </FormCard>
    </div>
  );
}
