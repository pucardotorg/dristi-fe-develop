import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { CmsContentPage } from "@/components/cms/cms-content-page";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: t("cmsContentPage_supportTitle") };
}

export default function SupportPage() {
  return <CmsContentPage slug="support" />;
}
