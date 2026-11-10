"use client";
import {useTranslations as __useTranslations} from "@/i18n/use-translations";
import {LocalizedText as __LocalizedText} from "@/components/localized-text";

import * as React from "react";

import { ChromeDialogContent } from "@/components/chrome/app-chrome";

import { EMPTY_PROFILE, useProfile } from "@/lib/filing/profile";
import type { UserProfile } from "@/lib/filing/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormField } from "@/components/filing/form-field";
import { PrefixInput, TextField } from "@/components/filing/inputs";

/**
 * "Your details" — the stand-in for the product's account. What is entered here greets
 * the person on the dashboard, marks "you" among the signatories, and prefills the
 * advocate card on a new filing.
 */
export function ProfileDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ChromeDialogContent mobileSheet className="sm:max-w-md">
        {/* Mounted per open, so the form always starts from the stored profile. */}
        {open ? <ProfileForm onClose={() => onOpenChange(false)} /> : null}
      </ChromeDialogContent>
    </Dialog>
  );
}

function ProfileForm({ onClose }: { onClose: () => void }) {
  const __t = __useTranslations();
  const { profile, save } = useProfile();
  const [form, setForm] = React.useState<UserProfile>(profile ?? EMPTY_PROFILE);
  const [saving, setSaving] = React.useState(false);

  const set = <K extends keyof UserProfile>(key: K, value: UserProfile[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await save({
        name: form.name.trim(),
        mobile: form.mobile.replace(/\D/g, "").slice(-10),
        email: form.email.trim(),
        barNumber: form.barNumber.trim().toUpperCase(),
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-6">
      <DialogHeader>
        <DialogTitle>{<__LocalizedText id="profileDialog_yourDetails" />}</DialogTitle>
        <DialogDescription>
          {<__LocalizedText id="profileDialog_usedToGreetYouMarkYourSignature" />}{" "}</DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-4">
        <FormField label={__t("profileDialog_fullName")} required>
          <TextField
            value={form.name}
            onChange={(v) => set("name", v)}
            placeholder={__t("profileDialog_asOnYourBarEnrolment")}
            autoComplete="name"
            required
          />
        </FormField>
        <FormField label={__t("profileDialog_mobileNumber")}>
          <PrefixInput
            prefix="+91"
            value={form.mobile}
            onChange={(v) => set("mobile", v.replace(/\D/g, "").slice(0, 10))}
            inputMode="numeric"
            autoComplete="tel-national"
            placeholder={__t("profileDialog_10DigitNumber")}
          />
        </FormField>
        <FormField label={__t("profileDialog_email")} optional>
          <TextField
            type="email"
            value={form.email}
            onChange={(v) => set("email", v)}
            autoComplete="email"
            placeholder={__t("profileDialog_youExampleCom")}
          />
        </FormField>
        <FormField
          label={__t("profileDialog_barRegistrationNumber")}
          optional
          help="Leave empty if you file as a party in person."
        >
          <TextField
            value={form.barNumber}
            onChange={(v) => set("barNumber", v.toUpperCase())}
            placeholder="e.g. K/1234/2015"
            autoComplete="off"
          />
        </FormField>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          {<__LocalizedText id="profileDialog_cancel" />}{" "}</Button>
        <Button type="submit" disabled={saving || !form.name.trim()}>
          {<__LocalizedText id="profileDialog_saveDetails" />}{" "}</Button>
      </DialogFooter>
    </form>
  );
}
