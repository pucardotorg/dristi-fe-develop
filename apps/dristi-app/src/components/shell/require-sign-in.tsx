"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { PROFILE_ROLE_KEY } from "@/components/shell/profile";
import { useLocalStorageValue } from "@/hooks/use-local-storage-value";
import { useMounted } from "@/lib/filing/store";

/**
 * The gate on the signed-in shell. Every citizen-side screen renders inside `AppShell`
 * (`app-shell.tsx`), so one guard here keeps the whole protected area — home, cases,
 * tasks, filings, vakalatnama, people, settings, and the in-app Join a case — out of
 * reach of anyone without a session.
 *
 * "Signed in" is the presence of the sign-in hint the citizen sign-in writes
 * (`PROFILE_ROLE_KEY`) and that `signOut` clears. That is set on every successful sign-in
 * in both the backend (`api`) and the demo (`sandbox`) mode, so the guard holds in either
 * — a demo reviewer still signs in, so they still pass. Reading the hint is enough for the
 * one requirement: after sign-out nothing protected renders, on any route and on Back.
 * Whether the backend session is *still* valid is a separate, heavier question
 * (`GET /users/me`) deliberately left out here.
 *
 * `localStorage` is not readable on the server, so the hint is read through
 * `useLocalStorageValue` (the codebase's hydration-safe `useSyncExternalStore` wrapper):
 * it reports `null` during SSR and the hydration pass, then the real value. `useMounted`
 * tells those two `null`s apart from a genuinely-absent hint, so the redirect fires only
 * once the browser value is known — never on the transient first paint. Until then the
 * shell renders nothing, a blank tick on a hard reload, which is the safe side of the
 * trade: better a blank frame for a signed-in person than a frame of data for a
 * signed-out one.
 *
 * Sign-out itself navigates away (`router.replace("/citizen")`), so this does not need to
 * watch the hint live; its job is the *arrival* at a protected route — a reload, a deep
 * link, or Back after signing out, which is where data was leaking through before.
 */
export function RequireSignIn({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const mounted = useMounted();
  const signedIn = useLocalStorageValue(PROFILE_ROLE_KEY) !== null;

  React.useEffect(() => {
    if (mounted && !signedIn) router.replace("/citizen");
  }, [mounted, signedIn, router]);

  if (!mounted || !signedIn) return null;
  return <>{children}</>;
}
