import type { Metadata } from "next";
import { Suspense } from "react";

import { ProfileProvider } from "@/lib/filing/profile";
import { EsignCompleteScreen } from "@/components/esign/esign-complete-screen";

export const metadata: Metadata = { title: "Aadhaar e-sign" };

/**
 * `/esign/return` — where the backend sends the browser back after Aadhaar e-sign
 * (`ESIGN_UI_REDIRECT_URL`), with `transaction_id` and `status` in the query. Outside the
 * filings area, so it mounts the profile itself to know who is signing. The query is read
 * on the client, so the page needs a Suspense boundary to be prerendered.
 */
export default function Page() {
  return (
    <ProfileProvider>
      <Suspense fallback={null}>
        <EsignCompleteScreen />
      </Suspense>
    </ProfileProvider>
  );
}
