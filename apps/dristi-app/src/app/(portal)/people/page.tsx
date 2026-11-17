"use client";

import * as React from "react";

import { UsersIcon } from "lucide-react";

import { PeoplePage } from "@/components/access/people-page";
import { useLocale } from "@/components/shell/locale";
import { ProfileScopedEmpty } from "@/components/shell/profile-scoped-empty";
import { useTranslations } from "next-intl";

/** People — the office. Opening a person goes to their own page. */
export default function Page() {
  const t = useTranslations();
  const { locale } = useLocale();
  return (
    <ProfileScopedEmpty
      title={t("peoplePage_noOneHasAccessYet")}
      description={t("peoplePage_peopleYouShareYourCasesWith")}
      icon={<UsersIcon aria-hidden />}
    >
      <PeoplePage locale={locale} />
    </ProfileScopedEmpty>
  );
}
