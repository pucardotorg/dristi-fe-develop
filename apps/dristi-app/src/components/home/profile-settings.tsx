"use client";

import * as React from "react";
import { CheckIcon, ChevronsUpDownIcon, ExternalLinkIcon, FileTextIcon, PencilIcon, PlusIcon } from "lucide-react";


import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AddIdForm, SubmittedIdSummary, type SubmittedId } from "@/components/home/add-id-dialog";
import { DocumentPreviewDialog, DocumentRowValue, DocumentThumbnailButton, useObjectUrl } from "@/components/document-preview";
import { DocumentSlot } from "@/components/ui/document-slot";
import { DescriptionDetails, DescriptionList, DescriptionRow, DescriptionTerm } from "@/components/ui/description-list";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Locale } from "@/lib/onboarding/content";
import { Identifier } from "@/components/chrome/identifier";
import { useCourtText } from "@/components/court/court-provider";
import type { ProfileRole } from "@/components/shell/profile";
import { StatusLine } from "@/components/feedback";
import { useTranslations } from "next-intl";
import type { MessageKey } from "@/i18n/messages";

const REQUIRED_MARK = <span className="text-destructive">*</span>;

export type AdvocateRequestDetails = {
  barNumber: string;
  idFile: File;
};

const ACCOUNT_LABEL: Record<ProfileRole, MessageKey> = {
  advocate: "profileSettings_advocateAccount",
  litigant: "profileSettings_litigantAccount",
  clerk: "profileSettings_clerkAccount",
};

export function ProfileSettings({ locale, profileName, idSubmitted, submittedId, advocateRequest, profileRole, advocateProfileAvailable, onIdSubmitted, onProfileCompleted, onAdvocateRequest, onSwitchProfile }: {
  locale: Locale;
  profileName: string;
  idSubmitted: boolean;
  submittedId: SubmittedId | null;
  advocateRequest: AdvocateRequestDetails | null;
  profileRole: ProfileRole;
  advocateProfileAvailable: boolean;
  onIdSubmitted: (submission: SubmittedId) => void;
  onProfileCompleted: () => void;
  onAdvocateRequest: (details: AdvocateRequestDetails) => void;
  onSwitchProfile: (role: ProfileRole) => void;
}) {
  const t = useTranslations();
  const [addressSaved, setAddressSaved] = React.useState(false);
  const [addressOpen, setAddressOpen] = React.useState(false);
  const [idOpen, setIdOpen] = React.useState(false);
  const [upgradeOpen, setUpgradeOpen] = React.useState(false);
  const [upgradeTouched, setUpgradeTouched] = React.useState(false);
  const [upgradeDetailsOpen, setUpgradeDetailsOpen] = React.useState(false);
  const [barNumber, setBarNumber] = React.useState("");
  const [barId, setBarId] = React.useState<File | null>(null);
  const [barIdPreviewOpen, setBarIdPreviewOpen] = React.useState(false);
  const barIdInputRef = React.useRef<HTMLInputElement>(null);
  const barIdUrl = useObjectUrl(barId);
  const initials = profileName.split(/\s+/).map((part) => part[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
  const upgradeIncomplete = !barNumber.trim() || !barId;

  function submitUpgrade(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setUpgradeTouched(true);
    if (upgradeIncomplete) return;
    setUpgradeOpen(false);
    onAdvocateRequest({
      barNumber,
      idFile: barId,
    });
  }

  return (
    <main lang={locale} className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-4 py-8 md:px-6 md:py-10">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col items-center gap-3 text-center">
          <Avatar className="size-24"><AvatarFallback className="bg-brand-muted text-title font-semibold text-brand-muted-foreground">{initials}</AvatarFallback></Avatar>
          <div className="flex flex-col items-center gap-2">
            {profileRole === "litigant" ? (
              <EditableName value={profileName} />
            ) : (
              <h1 className="text-title-l font-semibold">{profileName}</h1>
            )}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" aria-label={t("profileSettings_switchProfile")}>
                  {t(ACCOUNT_LABEL[profileRole])}
                  <ChevronsUpDownIcon data-icon="inline-end" aria-hidden />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="center" className="w-64 p-2">
                <p className="px-2 py-1.5 text-caption font-semibold text-muted-foreground">{t("profileSettings_switchProfile")}</p>
                <Button variant="ghost" className="w-full justify-start" onClick={() => onSwitchProfile("litigant")}>
                  <Avatar size="sm"><AvatarFallback>{t("profileSettings_l")}</AvatarFallback></Avatar>
                  <span className="flex-1 text-left">{t("profileSettings_litigant")}</span>
                  {profileRole === "litigant" ? <CheckIcon aria-hidden /> : null}
                </Button>
                {advocateProfileAvailable ? (
                  <Button variant="ghost" className="w-full justify-start" onClick={() => onSwitchProfile("advocate")}>
                    <Avatar size="sm"><AvatarFallback>{t("profileSettings_a")}</AvatarFallback></Avatar>
                    <span className="flex-1 text-left">{t("profileSettings_advocate")}</span>
                    {profileRole === "advocate" ? <CheckIcon aria-hidden /> : null}
                  </Button>
                ) : null}
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </div>

      <section className="flex flex-col gap-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div><h2 className="text-title-s font-semibold">{t("profileSettings_address")}</h2><p className="text-body-compact text-muted-foreground">{t("profileSettings_addTheAddressTheCourtShould")}</p></div>
          <div className="flex items-center gap-2">
            {addressSaved ? <Badge variant="success">{t("profileSettings_addressAdded")}</Badge> : null}
            {!addressOpen ? <Button variant="outline" onClick={() => setAddressOpen(true)}>{!addressSaved ? <PlusIcon data-icon="inline-start" aria-hidden /> : null}{addressSaved ? t("profileSettings_editAddress") : t("profileSettings_addAddress")}</Button> : null}
          </div>
        </div>
        {addressOpen || addressSaved ? (
          <form className={addressOpen ? "grid grid-cols-1 gap-4 sm:grid-cols-2" : "hidden"} onSubmit={(event) => { event.preventDefault(); setAddressSaved(true); setAddressOpen(false); onProfileCompleted(); }}>
            <Field><FieldLabel>{t("profileSettings_pinCode")} {REQUIRED_MARK}</FieldLabel><Input required inputMode="numeric" maxLength={6} /></Field>
            <Field><FieldLabel>{t("profileSettings_state")} {REQUIRED_MARK}</FieldLabel><Input required /></Field>
            <Field><FieldLabel>{t("profileSettings_district")} {REQUIRED_MARK}</FieldLabel><Input required /></Field>
            <Field><FieldLabel>{t("profileSettings_cityOrTown")} {REQUIRED_MARK}</FieldLabel><Input required /></Field>
            <Field className="sm:col-span-2"><FieldLabel>{t("profileSettings_localityStreetOrArea")} {REQUIRED_MARK}</FieldLabel><Input required /></Field>
            <Field><FieldLabel>{t("profileSettings_buildingNameOptional")}</FieldLabel><Input /></Field>
            <Field><FieldLabel>{t("profileSettings_doorOrHouseNumber")} {REQUIRED_MARK}</FieldLabel><Input required /></Field>
            <div className="flex justify-end gap-2 pt-2 sm:col-span-2">
              <Button type="button" variant="ghost" onClick={() => setAddressOpen(false)}>{t("common_cancel")}</Button>
              <Button type="submit">{t("profileSettings_saveAddress")}</Button>
            </div>
          </form>
        ) : null}
      </section>

      <section className="flex flex-col gap-5 border-t border-border pt-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div><h2 className="text-title-s font-semibold">{t("profileSettings_officialId")}</h2><p className="text-body-compact text-muted-foreground">{t("profileSettings_addOneOfficialIdToYour")}</p></div>
          {idSubmitted ? <Badge variant="success">{t("profileSettings_idSubmitted")}</Badge> : !idOpen ? <Button variant="outline" onClick={() => setIdOpen(true)}><PlusIcon data-icon="inline-start" aria-hidden /> {t("profileSettings_addId")}</Button> : null}
        </div>
        {submittedId ? <SubmittedIdSummary submission={submittedId} locale={locale} /> : idOpen ? <AddIdForm locale={locale} onCancel={() => setIdOpen(false)} onSubmitted={(submission) => { setIdOpen(false); onIdSubmitted(submission); }} /> : null}
      </section>

      <section className="flex flex-col gap-5 border-t border-border pt-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-title-s font-semibold">
              {advocateProfileAvailable ? t("profileSettings_advocateDetails") : t("profileSettings_requestAnAdvocateProfile")}
            </h2>
            <p className="text-body-compact text-muted-foreground">
              {advocateProfileAvailable
                ? t("profileSettings_yourAdvocateEnrolmentDetailsOnFile")
                : t("profileSettings_requestAnAdvocateProfileAlongWith")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {advocateProfileAvailable ? <Badge variant="success"><CheckIcon data-icon="inline-start" aria-hidden /> {t("profileSettings_approved")}</Badge> : null}
            {advocateRequest ? (
              <Button variant="outline" onClick={() => setUpgradeDetailsOpen((current) => !current)}>
                {advocateProfileAvailable
                  ? (upgradeDetailsOpen ? t("profileSettings_hideDetails") : t("profileSettings_editAdvocateDetails"))
                  : (upgradeDetailsOpen ? t("profileSettings_hideSubmittedInformation") : t("profileSettings_viewSubmittedInformation"))}
              </Button>
            ) : advocateProfileAvailable ? (
              <Button variant="outline" onClick={() => setUpgradeOpen(true)}>{t("profileSettings_editAdvocateDetails")}</Button>
            ) : !upgradeOpen ? (
              <Button variant="outline" onClick={() => setUpgradeOpen(true)}>{t("profileSettings_requestAdvocateProfile")}</Button>
            ) : null}
          </div>
        </div>
        {advocateRequest && !advocateProfileAvailable ? <StatusLine tone="info" still title={t("profileSettings_yourRequestHasBeenSubmitted")}>{t("profileSettings_weWillNotifyYouWhenYour")}</StatusLine> : null}
        {upgradeDetailsOpen && advocateRequest ? (
          <DescriptionList className="rounded-lg bg-muted px-4">
            <DescriptionRow><DescriptionTerm>{t("profileSettings_barRegistrationNumber")}</DescriptionTerm><DescriptionDetails><Identifier value={advocateRequest.barNumber} label={t("profileSettings_barRegistrationNumberLabel")} /></DescriptionDetails></DescriptionRow>
            <DescriptionRow className="items-center"><DescriptionTerm>{t("profileSettings_barCouncilId")}</DescriptionTerm><DescriptionDetails><DocumentRowValue file={advocateRequest.idFile} locale={locale} /></DescriptionDetails></DescriptionRow>
          </DescriptionList>
        ) : null}
        {upgradeOpen && !advocateRequest ? (
          <form className="flex flex-col gap-4 rounded-lg bg-muted p-6" noValidate onSubmit={submitUpgrade}>
            <p className="text-body-compact text-muted-foreground">{t("profileSettings_theseDetailsLetTheCourtVerify")}</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field data-invalid={upgradeTouched && !barNumber.trim()}>
                <FieldLabel>{t("profileSettings_barRegistrationNumber")} {REQUIRED_MARK}</FieldLabel>
                <Input value={barNumber} onChange={(event) => { setBarNumber(event.target.value); setUpgradeTouched(false); }} placeholder={t("profileSettings_forExampleK12342020")} />
                <FieldError>{upgradeTouched && !barNumber.trim() ? t("profileSettings_enterYourBarRegistrationNumber") : null}</FieldError>
              </Field>
            </div>
            <Field data-invalid={upgradeTouched && !barId}>
              <FieldLabel>{t("profileSettings_barCouncilId")} {REQUIRED_MARK}</FieldLabel>
              <input ref={barIdInputRef} type="file" className="hidden" tabIndex={-1} aria-hidden="true" accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf" onChange={(event) => { setBarId(event.target.files?.[0] ?? null); setUpgradeTouched(false); }} />
              <DocumentSlot status={barId ? "filled" : "empty"} media={barId && barIdUrl ? "thumbnail" : "icon"} label={t("profileSettings_barCouncilId")} required filename={barId?.name} thumbnail={barId && barIdUrl ? <DocumentThumbnailButton file={barId} url={barIdUrl} locale={locale} onOpen={() => setBarIdPreviewOpen(true)} className="size-full" /> : <FileTextIcon className="size-5" aria-hidden />} onChooseFile={() => barIdInputRef.current?.click()} copy={{ noFile: t("profileSettings_noFileChosenYet"), chooseFile: t("profileSettings_chooseFile") }} />
              <div className="flex items-start justify-between gap-4"><FieldDescription>{t("profileSettings_ensureTheRegistrationNumberIsClearly")}</FieldDescription>{barId ? <Button type="button" variant="link" className="h-auto shrink-0 p-0" onClick={() => barIdInputRef.current?.click()}>{t("profileSettings_changeFile")}</Button> : null}</div>
              <FieldError>{upgradeTouched && !barId ? t("profileSettings_uploadYourBarCouncilId") : null}</FieldError>
            </Field>
            <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => { setUpgradeOpen(false); setUpgradeTouched(false); }}>{t("common_cancel")}</Button><Button type="submit">{t("profileSettings_sendRequest")}</Button></div>
            <DocumentPreviewDialog open={barIdPreviewOpen} onOpenChange={setBarIdPreviewOpen} file={barId} url={barIdUrl} locale={locale} />
          </form>
        ) : null}
      </section>

      {/* Password */}
      <section className="flex flex-col gap-5 border-t border-border pt-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-title-s font-semibold">{t("profileSettings_password")}</h2>
            <p className="text-body-compact text-muted-foreground">{t("profileSettings_setOrChangeThePasswordYou")}</p>
          </div>
          <Button variant="outline">{t("profileSettings_setPassword")}</Button>
        </div>
      </section>

      {/* Demo only: the litigation system that pushes cases through the Bulk Filing API (`src/provakil/`). */}
      <section className="flex flex-col gap-5 border-t border-border pt-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-title-s font-semibold">{t("profileSettings_provakilDemo")}</h2>
            <p className="text-body-compact text-muted-foreground">{t("profileSettings_aStandInForALenders")}</p>
          </div>
          <Button variant="outline" asChild>
            <a href="/provakil" target="_blank" rel="noreferrer">
              {t("profileSettings_openProvakil")}
              <ExternalLinkIcon data-icon="inline-end" aria-hidden />
            </a>
          </Button>
        </div>
      </section>

    </main>
  );
}

/* ────────────────────────── Helpers ────────────────────────── */

/**
 * The profile name, editable in-place for litigants (whose names are self-reported).
 * Advocates' names come from the Bar Council register and must not be changed here.
 */
function EditableName({ value }: { value: string }) {
  const t = useTranslations();
  const [editing, setEditing] = React.useState(false);
  // The field opens on the name as the heading shows it (Settings' court switch).
  const courtText = useCourtText();
  const [name, setName] = React.useState(() => courtText(value));
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  if (!editing) {
    return (
      <button
        type="button"
        className="group flex items-center gap-2 rounded-md px-2 py-1 transition-colors hover:bg-muted"
        onClick={() => setEditing(true)}
        aria-label={t("profileSettings_editName")}
      >
        <h1 className="text-title-l font-semibold">{name || value}</h1>
        <PencilIcon className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
      </button>
    );
  }

  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(e) => { e.preventDefault(); setEditing(false); }}
    >
      <Input
        ref={inputRef}
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="text-title-l font-semibold text-center"
        onBlur={() => setEditing(false)}
        aria-label={t("profileSettings_fullName")}
      />
    </form>
  );
}
