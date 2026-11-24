"use client";

import * as React from "react";

import { isNotIntegratedError } from "@/lib/data/source";

import { deleteDraftWithFiles, getRepository } from "./data";
import type { FilingDraft } from "./types";
import { useTranslations } from "next-intl";

/**
 * All drafts and filed cases in this browser, newest first; `ready` once read.
 * `notConnected`: the backend doesn't answer `listDrafts` yet, a known state rather than a
 * failure, so screens show it without a retry.
 */
export function useDrafts() {
  const tr = useTranslations();
  const [drafts, setDrafts] = React.useState<FilingDraft[]>([]);
  const [ready, setReady] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [notConnected, setNotConnected] = React.useState(false);
  /** Wall-clock at the last read — for "filed in the last 12 months" without Date.now() in render. */
  const [readAt, setReadAt] = React.useState<number>(0);
  const [reloadTick, setReloadTick] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const all = await getRepository().listDrafts();
        if (cancelled) return;
        setDrafts(all);
        setError(null);
        setNotConnected(false);
      } catch (e) {
        if (cancelled) return;
        const unplugged = isNotIntegratedError(e);
        // The missing method goes to the console for whoever connects it.
        if (unplugged) console.warn(String(e));
        setNotConnected(unplugged);
        setError(
          unplugged
            ? tr("useDrafts_draftsArentConnectedYet")
            : tr("useDrafts_weCouldntReadYourDraftsFrom"),
        );
      }
      if (cancelled) return;
      setReadAt(Date.now());
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadTick, tr]);

  const reload = React.useCallback(() => setReloadTick((t) => t + 1), []);

  const discard = React.useCallback(async (id: string) => {
    await deleteDraftWithFiles(id);
    setDrafts((prev) => prev.filter((d) => d.id !== id));
  }, []);

  return {
    ready,
    error,
    notConnected,
    readAt,
    drafts: drafts.filter((d) => d.status === "draft"),
    filed: drafts
      .filter((d) => d.status === "filed")
      .sort((a, b) => (b.filedAt ?? "").localeCompare(a.filedAt ?? "")),
    reload,
    discard,
  };
}
