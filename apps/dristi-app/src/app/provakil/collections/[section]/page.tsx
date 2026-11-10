import {useTranslations as __useTranslations} from "@/i18n/server-translations";
import { NotInDemo } from "@/provakil/components/shell";

const TITLES: Record<string, string> = {
  dashboard: "Dashboard",
  notices: "Legal Notices",
  workflows: "Legal Action Workflows",
  causelist: "Causelist",
  hearings: "Hearings",
  advocates: "Advocates",
  spend: "Legal Spend",
  reports: "Reports",
};

export default async function Page({ params }: { params: Promise<{ section: string }> }) {
  const __t = __useTranslations();
  const { section } = await params;
  return <NotInDemo title={__t(TITLES[section]) ?? __t("sectionPage_notFound")} />;
}
