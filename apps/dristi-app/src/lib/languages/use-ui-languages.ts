"use client";

import { useEffect, useState } from "react";

import { isNotIntegratedError } from "@/lib/data/source";

import { getLanguagesRepository } from "./data";
import type { UiLanguage } from "./types";

export type UiLanguagesState =
  | { status: "loading" }
  | { status: "ready"; languages: UiLanguage[] }
  | { status: "not-connected" }
  | { status: "failed" };

/**
 * One request per page load, shared by every caller: the list changes only when the
 * backend is reconfigured. A failure is forgotten so the next mount asks again.
 */
let pending: Promise<UiLanguage[]> | null = null;

function loadOnce(): Promise<UiLanguage[]> {
  pending ??= getLanguagesRepository()
    .listUiLanguages()
    .catch((error: unknown) => {
      pending = null;
      throw error;
    });
  return pending;
}

/**
 * The languages the interface may be shown in. Only this browser's view reads them, so
 * other tabs need not hear of a change. Starts as "loading" on the server and the client
 * alike, so the first render matches.
 */
export function useUiLanguages(): UiLanguagesState {
  const [state, setState] = useState<UiLanguagesState>({ status: "loading" });

  useEffect(() => {
    let live = true;
    loadOnce().then(
      (languages) => {
        if (live) setState({ status: "ready", languages });
      },
      (error: unknown) => {
        if (live) setState({ status: isNotIntegratedError(error) ? "not-connected" : "failed" });
      },
    );
    return () => {
      live = false;
    };
  }, []);

  return state;
}
