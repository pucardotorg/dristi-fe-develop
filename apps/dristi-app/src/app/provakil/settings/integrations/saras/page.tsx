import {useTranslations as __useTranslations} from "@/i18n/server-translations";
import {LocalizedText as __LocalizedText} from "@/components/localized-text";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { CheckCircle2Icon, ChevronRightIcon, ScaleIcon } from "lucide-react";

import { MAPPING } from "@/provakil/lib/connector";
import { ADVOCATES, BANK, OFFICERS } from "@/provakil/lib/matters";

export const metadata: Metadata = { title: "SARAS 2.0 connector" };

/** Settings › Integrations › SARAS 2.0: what the connector sends, and from where. */
export default async function Page() {
  const __t = __useTranslations();
  // SARAS 2.0 is served from this same address (`app/provakil/layout.tsx`).
  const h = await headers();
  const DRISTI_URL = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  return (
    <div className="flex flex-col gap-5 p-6">
      <div>
        <nav className="flex items-center gap-1 text-[12px] text-(--pv-muted)" aria-label={__t("sarasPage_breadcrumb")}>
          <span>{<__LocalizedText id="sarasPage_settings" />}</span>
          <ChevronRightIcon className="size-3" aria-hidden />
          <span>{<__LocalizedText id="sarasPage_integrations" />}</span>
        </nav>
        <div className="mt-1 flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-md bg-(--pv-plum-50) text-(--pv-plum)">
            <ScaleIcon className="size-5" aria-hidden />
          </span>
          <div>
            <h1 className="text-[22px] font-medium">{<__LocalizedText id="sarasPage_saras20EFilingConnector" />}</h1>
            <p className="text-[13px] text-(--pv-muted)">{<__LocalizedText id="sarasPage_section138ComplaintsToSaras20" />}</p>
          </div>
          <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-(--pv-teal-50) px-3 py-1 text-[12px] font-medium text-[#00796b]">
            <CheckCircle2Icon className="size-4" aria-hidden />
            {<__LocalizedText id="sarasPage_connected" />}{" "}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <section className="rounded-lg border border-(--pv-line) bg-white p-4 shadow-sm">
          <h2 className="mb-3 font-medium">{<__LocalizedText id="sarasPage_connection" />}</h2>
          <dl className="flex flex-col gap-2 text-[13px]">
            <div><dt className="text-[11px] text-(--pv-muted) uppercase">{<__LocalizedText id="sarasPage_endpoint" />}</dt><dd className="num break-all">{DRISTI_URL}{<__LocalizedText id="sarasPage_apiBulkV1Batches" />}</dd></div>
            <div><dt className="text-[11px] text-(--pv-muted) uppercase">{<__LocalizedText id="sarasPage_apiKey" />}</dt><dd className="num">{<__LocalizedText id="sarasPage_key" />}</dd></div>
            <div><dt className="text-[11px] text-(--pv-muted) uppercase">{<__LocalizedText id="sarasPage_court" />}</dt><dd>{<__LocalizedText id="sarasPage_ahmedabadGujaratS138NiAct" />}</dd></div>
            <div><dt className="text-[11px] text-(--pv-muted) uppercase">{<__LocalizedText id="sarasPage_willingToSettleByAdr" />}</dt><dd>{<__LocalizedText id="sarasPage_no" />}</dd></div>
          </dl>
        </section>
        <section className="rounded-lg border border-(--pv-line) bg-white p-4 shadow-sm">
          <h2 className="mb-3 font-medium">{<__LocalizedText id="sarasPage_complainantCompanyProfile" />}</h2>
          <dl className="flex flex-col gap-2 text-[13px]">
            <div><dt className="text-[11px] text-(--pv-muted) uppercase">{<__LocalizedText id="sarasPage_legalName" />}</dt><dd>{BANK.legalName}</dd></div>
            <div><dt className="text-[11px] text-(--pv-muted) uppercase">{<__LocalizedText id="sarasPage_cin" />}</dt><dd className="num">{BANK.cin}</dd></div>
            <div><dt className="text-[11px] text-(--pv-muted) uppercase">{<__LocalizedText id="sarasPage_registeredOffice" />}</dt><dd>{BANK.registeredOffice.line}, {BANK.registeredOffice.city} {BANK.registeredOffice.pincode}</dd></div>
          </dl>
        </section>
        <section className="rounded-lg border border-(--pv-line) bg-white p-4 shadow-sm">
          <h2 className="mb-3 font-medium">{<__LocalizedText id="sarasPage_authorisedOfficers" />}</h2>
          <ul className="flex flex-col gap-2 text-[13px]">
            {Object.entries(OFFICERS).map(([region, o]) => (
              <li key={region}>
                <div className="font-medium">{o.name}</div>
                <div className="text-[12px] text-(--pv-muted)">{o.designation} · {region}</div>
              </li>
            ))}
          </ul>
          <h3 className="mt-4 mb-2 text-[11px] text-(--pv-muted) uppercase">{<__LocalizedText id="sarasPage_empanelledAdvocates" />}</h3>
          <ul className="flex flex-col gap-1 text-[13px]">
            {ADVOCATES.map((a) => (
              <li key={a.enrolment}>{a.name} <span className="num text-(--pv-muted)">{a.enrolment}</span></li>
            ))}
          </ul>
        </section>
      </div>

      <section className="rounded-lg border border-(--pv-line) bg-white shadow-sm">
        <div className="border-b border-(--pv-line) p-4">
          <h2 className="font-medium">{<__LocalizedText id="sarasPage_fieldMapping" />}</h2>
          <p className="text-[13px] text-(--pv-muted)">{<__LocalizedText id="sarasPage_fixedRulesAValueNoRuleCovers" />}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-[13px]">
            <thead className="bg-[#f7f9fc] text-[11px] tracking-wide text-(--pv-muted) uppercase">
              <tr>
                <th className="px-4 py-2.5">{<__LocalizedText id="sarasPage_saras20Field" />}</th>
                <th className="px-4 py-2.5">{<__LocalizedText id="sarasPage_id" />}</th>
                <th className="px-4 py-2.5">{<__LocalizedText id="sarasPage_provakilSource" />}</th>
                <th className="px-4 py-2.5">{<__LocalizedText id="sarasPage_rule" />}</th>
              </tr>
            </thead>
            {MAPPING.map((g) => (
              <tbody key={g.group}>
                <tr>
                  <th colSpan={4} className="bg-(--pv-ground) px-4 py-2 text-left text-[12px] font-medium text-(--pv-slate)">{g.group}</th>
                </tr>
                {g.rows.map((r) => (
                  <tr key={r.id + r.dristi} className="border-t border-(--pv-line)">
                    <td className="px-4 py-2">{r.dristi}</td>
                    <td className="num px-4 py-2 text-(--pv-muted)">{r.id}</td>
                    <td className="px-4 py-2">{r.provakil}</td>
                    <td className="px-4 py-2 text-(--pv-slate)">{r.rule}</td>
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>
      </section>
    </div>
  );
}
