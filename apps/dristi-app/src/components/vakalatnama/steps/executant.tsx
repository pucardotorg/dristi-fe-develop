"use client";
import {useTranslations as __useTranslations} from "@/i18n/use-translations";
import {LocalizedText as __LocalizedText} from "@/components/localized-text";

/** S1 — the litigant the vakalatnama is from. Individual, or organisation via signatory. */

import * as React from "react";

import { FormCard, FormRow } from "@/components/filing/form-card";
import { FormField } from "@/components/filing/form-field";
import { TextField, OptionSelect, PrefixInput } from "@/components/filing/inputs";
import { Segmented } from "@/components/filing/segmented";
import { AddressFields } from "@/components/filing/address-fields";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { InfoIcon } from "lucide-react";
import { IdUpload } from "@/components/vakalatnama/id-upload";
import { updateVak } from "@/lib/vakalatnama/store";
import type { Address, Executant, Vakalatnama } from "@/lib/vakalatnama/types";

const RELATIONS = ["S/o", "D/o", "W/o"];

export function ExecutantStep({ vak }: { vak: Vakalatnama }) {
  const __t = __useTranslations();
  const e = vak.executant;
  const set = (patch: Partial<Executant>) =>
    updateVak(vak.id, (p) => ({ ...p, executant: { ...p.executant, ...patch } }));
  const setAddress = (addr: Address) => set({ address: addr });

  return (
    <div className="flex flex-col gap-6">
      {vak.creatorRole === "litigant" ? (
        <Alert>
          <InfoIcon aria-hidden />
          <AlertTitle>{<__LocalizedText id="executant_filedAsYourself" />}</AlertTitle>
          <AlertDescription>
            {<__LocalizedText id="executant_youAreTheLitigantOnThisVakalatnama" />}{" "}</AlertDescription>
        </Alert>
      ) : null}

      <FormCard
        title={__t("executant_whoIsAppointingTheAdvocate")}
        description={__t("executant_theLitigantThisVakalatnamaIsFrom")}
      >
        <FormField label={__t("executant_executant")} asGroup>
          <Segmented
            size="compact"
            value={e.kind}
            onValueChange={(v) => set({ kind: v })}
            options={[
              { value: "individual", label: __t("executant_anIndividual") },
              { value: "organisation", label: __t("executant_anOrganisation") },
            ]}
            ariaLabel="Executant kind"
          />
        </FormField>

        {e.kind === "individual" ? (
          <>
            <FormRow>
              <FormField label={__t("executant_fullName")} required>
                <TextField
                  value={e.name}
                  onChange={(v) => set({ name: v })}
                  placeholder={__t("executant_asOnRecord")}
                  autoComplete="name"
                />
              </FormField>
              <FormField label={__t("executant_age")} required>
                <TextField
                  value={e.age}
                  onChange={(v) => set({ age: v.replace(/\D/g, "").slice(0, 3) })}
                  placeholder={__t("executant_years")}
                  inputMode="numeric"
                  className="max-w-32"
                />
              </FormField>
            </FormRow>
            <FormRow>
              <FormField label={__t("executant_relation")} optional>
                <OptionSelect
                  value={e.relationType}
                  onValueChange={(v) => set({ relationType: v as Executant["relationType"] })}
                  options={RELATIONS}
                  placeholder={__t("executant_relationPlaceholder")}
                />
              </FormField>
              <FormField label={__t("executant_relationName")} optional>
                <TextField
                  value={e.relationName}
                  onChange={(v) => set({ relationName: v })}
                  placeholder={__t("executant_fatherHusbandSName")}
                />
              </FormField>
            </FormRow>
          </>
        ) : (
          <>
            <FormField label={__t("executant_organisationName")} required>
              <TextField
                value={e.orgName}
                onChange={(v) => set({ orgName: v })}
                placeholder={__t("executant_eGABankOrCompany")}
              />
            </FormField>
            <FormRow>
              <FormField
                label={__t("executant_authorisedSignatory")}
                required
                help="The person who signs for the organisation."
              >
                <TextField
                  value={e.signatoryName}
                  onChange={(v) => set({ signatoryName: v })}
                  placeholder={__t("executant_name")}
                  autoComplete="name"
                />
              </FormField>
              <FormField label={__t("executant_designation")} optional>
                <TextField
                  value={e.signatoryDesignation}
                  onChange={(v) => set({ signatoryDesignation: v })}
                  placeholder={__t("executant_eGManager")}
                />
              </FormField>
            </FormRow>
          </>
        )}

        <FormRow>
          <FormField
            label={__t("executant_mobileNumber")}
            required
            help="The signing OTP is sent to this number."
          >
            <PrefixInput
              prefix="+91"
              value={e.mobile}
              onChange={(v) => set({ mobile: v.replace(/\D/g, "").slice(0, 10) })}
              placeholder={__t("executant_10DigitMobile")}
              inputMode="numeric"
              autoComplete="tel-national"
            />
          </FormField>
          <FormField label={__t("executant_idCard")} required help="Proof of identity for the signer.">
            <IdUpload value={e.idDoc} onChange={(v) => set({ idDoc: v })} />
          </FormField>
        </FormRow>
      </FormCard>

      <FormCard title={__t("executant_address")} description={__t("executant_theLitigantSAddressForTheRecord")}>
        <AddressFields value={e.address} onChange={setAddress} idPrefix="vak-exec" />
      </FormCard>
    </div>
  );
}
