"use client";

/** S2 — the advocates being appointed. Bar-registry search; one marked for service. */

import * as React from "react";
import { PlusIcon, Trash2Icon, UserPlusIcon } from "lucide-react";

import { FormCard } from "@/components/filing/form-card";
import { FormField } from "@/components/filing/form-field";
import { ComboField, TextField } from "@/components/filing/inputs";
import { AddressFields } from "@/components/filing/address-fields";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { updateVak } from "@/lib/vakalatnama/store";
import { BAR_REGISTER, EMPTY_ADDRESS, makeAdvocateId, type BarAdvocate } from "@/lib/vakalatnama/data";
import type { Address, Advocate, Vakalatnama } from "@/lib/vakalatnama/types";
import { Identifier } from "@/components/chrome/identifier";
import { useTranslations } from "next-intl";

export function AdvocatesStep({ vak }: { vak: Vakalatnama }) {
  const t = useTranslations();
  const [query, setQuery] = React.useState("");
  const [manualName, setManualName] = React.useState("");
  const [manualEnrol, setManualEnrol] = React.useState("");

  const add = (name: string, enrolmentNo: string) => {
    const clean = name.trim();
    if (!clean) return;
    updateVak(vak.id, (p) => {
      const first = p.advocates.length === 0;
      const adv: Advocate = {
        id: makeAdvocateId(),
        name: clean,
        enrolmentNo: enrolmentNo.trim(),
        address: { ...EMPTY_ADDRESS },
        forService: first,
        accepted: false,
      };
      return { ...p, advocates: [...p.advocates, adv] };
    });
  };

  const remove = (id: string) =>
    updateVak(vak.id, (p) => {
      const rest = p.advocates.filter((a) => a.id !== id);
      // If we removed the service advocate, hand it to the first remaining one.
      if (rest.length && !rest.some((a) => a.forService)) rest[0] = { ...rest[0], forService: true };
      return { ...p, advocates: rest };
    });

  const setService = (id: string) =>
    updateVak(vak.id, (p) => ({
      ...p,
      advocates: p.advocates.map((a) => ({ ...a, forService: a.id === id })),
    }));

  const setAddress = (id: string, addr: Address) =>
    updateVak(vak.id, (p) => ({
      ...p,
      advocates: p.advocates.map((a) => (a.id === id ? { ...a, address: addr } : a)),
    }));

  const service = vak.advocates.find((a) => a.forService);

  return (
    <div className="flex flex-col gap-6">
      <FormCard
        title={t("stepsAdvocates_appointAdvocates")}
        description={t("stepsAdvocates_searchTheBarRegisterOrAdd")}
      >
        <FormField label={t("stepsAdvocates_findAnAdvocate")} asGroup help={t("stepsAdvocates_searchByNameOrEnrolmentNumber")}>
          <ComboField
            value={query}
            onChange={setQuery}
            items={BAR_REGISTER}
            itemKey={(a) => (a as BarAdvocate).enrolmentNo}
            itemLabel={(a) => (a as BarAdvocate).name}
            renderItem={(a) => {
              const b = a as BarAdvocate;
              return (
                <div className="flex w-full items-center justify-between gap-4">
                  <span>{b.name}</span>
                  {/* A combobox row is an option — no control nested inside it. */}
                  <Identifier
                    value={b.enrolmentNo}
                    label={t("stepsAdvocates_enrolmentNumber")}
                    className="text-caption text-muted-foreground"
                    copyable={false}
                  />
                </div>
              );
            }}
            onSelect={(a) => {
              const b = a as BarAdvocate;
              add(b.name, b.enrolmentNo);
              setQuery("");
            }}
            placeholder={t("stepsAdvocates_eGPradeeshChackoOrK")}
            emptyLabel={t("stepsAdvocates_noMatchAddByHandBelow")}
            ariaLabel={t("stepsAdvocates_searchTheBarRegister")}
          />
        </FormField>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_auto]">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label={t("stepsAdvocates_name")} optional>
              <TextField value={manualName} onChange={setManualName} placeholder={t("stepsAdvocates_advocatesName")} />
            </FormField>
            <FormField label={t("stepsAdvocates_enrolmentNo")} optional>
              <TextField value={manualEnrol} onChange={setManualEnrol} placeholder={t("stepsAdvocates_eGK3051996")} />
            </FormField>
          </div>
          <div className="flex items-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                add(manualName, manualEnrol);
                setManualName("");
                setManualEnrol("");
              }}
              disabled={!manualName.trim()}
            >
              <PlusIcon aria-hidden />
              {t("stepsAdvocates_add")}
            </Button>
          </div>
        </div>
      </FormCard>

      {vak.advocates.length === 0 ? (
        <FormCard title={t("stepsAdvocates_appointedAdvocates")}>
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <UserPlusIcon aria-hidden />
              </EmptyMedia>
              <EmptyTitle>{t("stepsAdvocates_noAdvocateAppointedYet")}</EmptyTitle>
              <EmptyDescription>
                {t("stepsAdvocates_addAtLeastOneAdvocateThe")}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </FormCard>
      ) : (
        <FormCard
          title={t("stepsAdvocates_appointedAdvocates")}
          description={t("stepsAdvocates_oneAdvocateIsTheAddressFor")}
        >
          <RadioGroup
            value={service?.id}
            onValueChange={setService}
            className="flex flex-col gap-3"
          >
            {vak.advocates.map((a) => (
              <div
                key={a.id}
                className="flex items-center gap-3 rounded-lg bg-surface-sunken p-3"
              >
                <RadioGroupItem value={a.id} id={`svc-${a.id}`} aria-label={t("stepsAdvocates_addressForService")} />
                <div className="flex min-w-0 flex-1 flex-col">
                  <Label htmlFor={`svc-${a.id}`} className="text-body font-medium">
                    {a.name}
                  </Label>
                  {a.enrolmentNo ? (
                    <Identifier
                      value={a.enrolmentNo}
                      label={t("stepsAdvocates_enrolmentNumber")}
                      className="self-start text-caption text-muted-foreground"
                    />
                  ) : (
                    <span className="text-caption text-muted-foreground">
                      {t("stepsAdvocates_noEnrolmentNumber")}
                    </span>
                  )}
                </div>
                {a.forService ? (
                  <span className="text-caption font-medium text-brand-muted-foreground">
                    {t("stepsAdvocates_forService")}
                  </span>
                ) : null}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={t("stepsAdvocates_removeName", { name: a.name })}
                  onClick={() => remove(a.id)}
                  className="text-muted-foreground"
                >
                  <Trash2Icon aria-hidden />
                </Button>
              </div>
            ))}
          </RadioGroup>
        </FormCard>
      )}

      {service ? (
        <FormCard
          title={t("stepsAdvocates_addressForService")}
          description={t("stepsAdvocates_whereTheCourtWillSendPapers", { name: service.name })}
        >
          <AddressFields
            value={service.address}
            onChange={(addr) => setAddress(service.id, addr)}
            idPrefix="vak-service"
          />
        </FormCard>
      ) : null}
    </div>
  );
}
