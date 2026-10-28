"use client";

/**
 * The signed-in person, as the filing flow needs to know them: a name to greet, a mobile
 * to mark "you" among the signatories, and a name and Bar number to prefill the advocate
 * card. Read once from the account (`GET /users/me`) when the filing area mounts.
 * `useProfile()` is the single read point.
 */

import * as React from "react";

import { getAuthService } from "@/lib/auth";

import type { UserProfile } from "./types";

export const EMPTY_PROFILE: UserProfile = { name: "", mobile: "", email: "", barNumber: "" };

type ProfileContextValue = {
  /** `null` until the account has been read. */
  profile: UserProfile | null;
  ready: boolean;
};

const ProfileContext = React.createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = React.useState<UserProfile | null>(null);
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    getAuthService()
      .getCurrentAccount()
      .then((account) => {
        if (cancelled) return;
        setProfile({
          name: account.name ?? "",
          mobile: account.mobile,
          email: account.email ?? "",
          barNumber: account.barNumber ?? "",
        });
        setReady(true);
      })
      .catch(() => {
        // Signed out or unreachable: the flow still renders, with nothing prefilled.
        if (cancelled) return;
        setProfile(EMPTY_PROFILE);
        setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const value = React.useMemo(() => ({ profile, ready }), [profile, ready]);
  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile(): ProfileContextValue {
  const ctx = React.useContext(ProfileContext);
  if (!ctx) throw new Error("useProfile must be used inside <ProfileProvider>");
  return ctx;
}

/** First name for greetings; empty when unknown. */
export function firstNameOf(name: string): string {
  return name.trim().split(/\s+/)[0] ?? "";
}
