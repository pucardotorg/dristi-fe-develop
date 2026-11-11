import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ProfileCases } from "@/components/cases/profile-cases";
import { getCasesRepository } from "@/lib/cases/data";
import { buildCasesHref, parseCasesQuery } from "@/lib/cases/query";

export const metadata: Metadata = {
  title: "Cases",
};

export default async function CasesPage(props: PageProps<"/cases">) {
  const query = parseCasesQuery(await props.searchParams);
  if (query.bucket) {
    redirect(buildCasesHref(query));
  }

  // Demo data or the court's, whichever this build's data source serves.
  const repo = getCasesRepository();
  const empty = query.demo === "empty";
  const [cases, partyCases, today] = await Promise.all([
    empty ? [] : repo.listOfficeCases(),
    empty ? [] : repo.listPartyCases(),
    repo.today(),
  ]);

  return (
    <ProfileCases
      query={query}
      officeCases={cases}
      partyCases={partyCases}
      now={new Date(today).getTime()}
    />
  );
}
