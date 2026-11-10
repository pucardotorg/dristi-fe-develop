"use client";
import {useTranslations as __useTranslations} from "@/i18n/use-translations";

import * as React from "react";

import { UsersIcon } from "lucide-react";

import { PeoplePage } from "@/components/access/people-page";
import { useLocale } from "@/components/shell/locale";
import { ProfileScopedEmpty } from "@/components/shell/profile-scoped-empty";

/** People — the office. Opening a person goes to their own page. */
export default function Page() {
  const __t = __useTranslations();
  const { locale } = useLocale();
  return (
    <ProfileScopedEmpty
      title={__t("peoplePage_noOneHasAccessYet")}
      description={__t("peoplePage_peopleYouShareYourCasesWithAdvocates")}
      icon={<UsersIcon aria-hidden />}
    >
      <PeoplePage locale={locale} />
    </ProfileScopedEmpty>
  );
}
