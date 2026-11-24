import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { CasesNotConnected } from "@/components/cases/cases-not-connected";
import { ProfileCases } from "@/components/cases/profile-cases";
import { getCasesRepository } from "@/lib/cases/data";
import { buildCasesHref, parseCasesQuery } from "@/lib/cases/query";
import { isNotIntegratedError } from "@/lib/data/source";

export const metadata: Metadata = {
  title: "Cases",
};

export default async function CasesPage(props: PageProps<"/cases">) {
  const query = parseCasesQuery(await props.searchParams);
  if (query.bucket) {
    redirect(buildCasesHref(query));
  }

  const loaded = await readCases(query.demo === "empty").catch((error: unknown) => {
    // Not connected is a known state, not a failure: say so here, without the error page's
    // Try again. The error page can't tell, because production hides server error details.
    if (!isNotIntegratedError(error)) throw error;
    // The missing method goes to the server log for whoever connects it.
    console.warn(error.message);
    return null;
  });
  if (!loaded) return <CasesNotConnected />;
  const [cases, partyCases, today] = loaded;

  return (
    <ProfileCases
      query={query}
      officeCases={cases}
      partyCases={partyCases}
      now={new Date(today).getTime()}
    />
  );
}

/** Demo data or the court's, whichever this build's data source serves. */
function readCases(empty: boolean) {
  const repo = getCasesRepository();
  return Promise.all([
    empty ? [] : repo.listOfficeCases(),
    empty ? [] : repo.listPartyCases(),
    repo.today(),
  ]);
}
