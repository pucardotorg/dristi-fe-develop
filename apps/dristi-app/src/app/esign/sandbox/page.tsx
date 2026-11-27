import type { Metadata } from "next";
import { Suspense } from "react";

import { SandboxProviderScreen } from "@/components/esign/sandbox-provider-screen";

export const metadata: Metadata = { title: "Sandbox e-sign" };

/**
 * `/esign/sandbox` — the sandbox's stand-in for C-DAC's Aadhaar OTP page, outside the
 * app's shell as C-DAC's own page is. Not found in any build that is not the sandbox.
 */
export default function Page() {
  return (
    <Suspense fallback={null}>
      <SandboxProviderScreen />
    </Suspense>
  );
}
