"use client";

/**
 * The signed-in person, as the filing flow needs to know them: a name to greet, a mobile
 * to mark "you" among the signatories, and, by role, the first complainant (a litigant)
 * or advocate card (an advocate) to prefill. Read once from the account (`GET /users/me`)
 * when the filing area mounts; `useProfile()` is the single read point.
 */

import * as React from "react";

import { getAuthService } from "@/lib/auth";

import { SIGNED_IN_MOBILE_KEY } from "./linked-complaints";
import type { UserProfile } from "./types";

export const EMPTY_PROFILE: UserProfile = {
  role: null,
  name: "",
  mobile: "",
  email: "",
  barNumber: "",
};

/**
 * Sandbox session-lite: while a litigant is signed in (`SIGNED_IN_MOBILE_KEY`, set only
 * for a litigant sign-in), this flow knows them by that mobile and holds no bar number,
 * so "you" is their complainant seat rather than the advocate's. Not written back.
 */
export function asSignedIn(profile: UserProfile, signedInMobile: string | null): UserProfile {
  return signedInMobile ? { ...profile, mobile: signedInMobile, barNumber: "" } : profile;
}

function readSignedInMobile(): string | null {
  try {
    return window.localStorage.getItem(SIGNED_IN_MOBILE_KEY);
  } catch {
    return null;
  }
}

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
          role: account.role,
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
        setProfile(asSignedIn(EMPTY_PROFILE, readSignedInMobile()));
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
