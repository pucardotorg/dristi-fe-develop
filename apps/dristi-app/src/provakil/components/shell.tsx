"use client";
import {useTranslations as __useTranslations} from "@/i18n/use-translations";
import {LocalizedText as __LocalizedText} from "@/components/localized-text";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3Icon,
  BellIcon,
  BriefcaseIcon,
  CalendarDaysIcon,
  ChevronDownIcon,
  FileTextIcon,
  GavelIcon,
  HelpCircleIcon,
  LayoutDashboardIcon,
  ListChecksIcon,
  SearchIcon,
  SettingsIcon,
  UsersIcon,
  WalletIcon,
  WorkflowIcon,
} from "lucide-react";

const NAV = [
  { href: "/provakil/collections/dashboard", label: "Dashboard", icon: LayoutDashboardIcon },
  { href: "/provakil/collections/notices", label: "Legal Notices", icon: FileTextIcon },
  { href: "/provakil/collections/workflows", label: "Legal Action Workflows", icon: WorkflowIcon },
  { href: "/provakil/collections/litigation", label: "Litigation", icon: GavelIcon },
  { href: "/provakil/collections/causelist", label: "Causelist", icon: ListChecksIcon },
  { href: "/provakil/collections/hearings", label: "Hearings", icon: CalendarDaysIcon },
  { href: "/provakil/collections/advocates", label: "Advocates", icon: UsersIcon },
  { href: "/provakil/collections/spend", label: "Legal Spend", icon: WalletIcon },
  { href: "/provakil/collections/reports", label: "Reports", icon: BarChart3Icon },
];

/** The only places the demo goes; everything else is shown greyed and inert. */
const LIVE = ["/provakil/collections/litigation"];

/** Provakil's chrome: navy top bar with the suite switcher, a white rail on the left. */
export function Shell({ children }: { children: React.ReactNode }) {
  const __t = __useTranslations();
  const pathname = usePathname();
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 flex h-14 items-center gap-4 bg-(--pv-navy) px-4 text-white">
        <Link href="/provakil/collections/litigation" className="flex items-baseline gap-0.5 pr-2" aria-label={__t("shell_provakilHome")}>
          <span className="text-[22px] font-bold tracking-tight lowercase">{<__LocalizedText id="shell_provakil" />}</span>
          <span className="size-1.5 rounded-full bg-[#00c9a7]" aria-hidden />
        </Link>
        <button disabled title={__t("shell_notPartOfThisDemo")} className="flex cursor-not-allowed items-center gap-2 whitespace-nowrap rounded-md bg-white/10 px-3 py-1.5 text-[13px] font-medium opacity-60">
          <BriefcaseIcon className="size-4" aria-hidden />
          {<__LocalizedText id="shell_legalCollections" />}{" "}<ChevronDownIcon className="size-4 opacity-70" aria-hidden />
        </button>
        <div className="mx-auto hidden w-full max-w-xl cursor-not-allowed items-center gap-2 rounded-md bg-white/10 px-3 py-1.5 opacity-50 md:flex" title={__t("shell_notPartOfThisDemo")}>
          <SearchIcon className="size-4 opacity-70" aria-hidden />
          <input
            disabled
            className="w-full cursor-not-allowed bg-transparent text-[13px] placeholder:text-white/60 focus:outline-none"
            placeholder={__t("shell_searchLanBorrowerCnrAdvocate")}
            aria-label={__t("shell_search")}
          />
        </div>
        <div className="ml-auto flex items-center gap-1">
          <button disabled className="cursor-not-allowed rounded-full p-2 opacity-50" aria-label={__t("shell_help")} title={__t("shell_notPartOfThisDemo")}>
            <HelpCircleIcon className="size-5" />
          </button>
          <button disabled className="relative cursor-not-allowed rounded-full p-2 opacity-50" aria-label={__t("shell_notifications")} title={__t("shell_notPartOfThisDemo")}>
            <BellIcon className="size-5" />
            <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-[#00c9a7]" />
          </button>
          <div className="ml-2 flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-full bg-(--pv-teal) text-[13px] font-medium">{<__LocalizedText id="shell_pv" />}</span>
            <div className="hidden whitespace-nowrap leading-tight xl:block">
              <div className="text-[13px] font-medium">{<__LocalizedText id="shell_priyaVyas" />}</div>
              <div className="text-[11px] text-white/60">{<__LocalizedText id="shell_legalManagerTataCapital" />}</div>
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        <nav className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-60 shrink-0 flex-col border-r border-(--pv-line) bg-white py-3 lg:flex">
          <ul className="flex flex-col gap-0.5 px-2">
            {NAV.map((item) => {
              const active = pathname.startsWith(item.href);
              const Icon = item.icon;
              if (!LIVE.includes(item.href))
                return (
                  <li key={item.href}>
                    <span
                      aria-disabled="true"
                      title={__t("shell_notPartOfThisDemo")}
                      className="flex cursor-not-allowed items-center gap-3 rounded-md px-3 py-2 text-[13px] text-(--pv-slate) opacity-35 select-none"
                    >
                      <Icon className="size-4" aria-hidden />
                      {__t(item.label)}
                    </span>
                  </li>
                );
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`flex items-center gap-3 rounded-md px-3 py-2 text-[13px] ${
                      active ? "bg-(--pv-blue-50) font-medium text-(--pv-blue)" : "text-(--pv-slate) hover:bg-(--pv-ground)"
                    }`}
                  >
                    <Icon className="size-4" aria-hidden />
                    {__t(item.label)}
                  </Link>
                </li>
              );
            })}
          </ul>
          <div className="mt-auto border-t border-(--pv-line) px-2 pt-2">
            <Link
              href="/provakil/settings/integrations/saras"
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-[13px] ${
                pathname.startsWith("/provakil/settings") ? "bg-(--pv-blue-50) font-medium text-(--pv-blue)" : "text-(--pv-slate) hover:bg-(--pv-ground)"
              }`}
            >
              <SettingsIcon className="size-4" aria-hidden />
              {<__LocalizedText id="shell_settings" />}{" "}</Link>
          </div>
        </nav>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}

/** Pages this demo does not build: the rail still leads somewhere honest. */
export function NotInDemo({ title }: { title: string }) {
  const __t = __useTranslations();
  return (
    <div className="p-6">
      <h1 className="text-xl font-medium">{__t(title)}</h1>
      <p className="mt-2 text-(--pv-muted)">{<__LocalizedText id="shell_notPartOfThisDemoTheDemo" />}</p>
    </div>
  );
}
