"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import { StatusLine } from "@/components/ui/status-line";
import { cmsLoadFailure } from "@/lib/cms/cms-page";
import { getCmsPage } from "@/lib/cms/data/http";
import type { CmsPage, CmsSlug } from "@/lib/cms/types";

type CmsContentPageProps = {
  slug: CmsSlug;
};

type LoadState =
  | { status: "loading" }
  | { status: "ready"; page: CmsPage }
  | { status: "not-found" }
  | { status: "failed" };

export function CmsContentPage({ slug }: CmsContentPageProps) {
  const t = useTranslations();
  const [state, setState] = useState<LoadState>({ status: "loading" });
  // Bumped by "Try again" so the effect runs the load once more.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    getCmsPage(slug, controller.signal).then(
      (page) => {
        if (!controller.signal.aborted) setState({ status: "ready", page });
      },
      (error: unknown) => {
        const failure = cmsLoadFailure(error);
        if (failure && !controller.signal.aborted) setState({ status: failure });
      },
    );
    return () => controller.abort();
  }, [slug, attempt]);

  function retry() {
    setState({ status: "loading" });
    setAttempt((value) => value + 1);
  }

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-12 md:px-8">
      {state.status === "loading" ? (
        <div className="flex justify-center py-12">
          <Spinner className="size-6 text-muted-foreground" />
        </div>
      ) : state.status === "not-found" ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>{t("cmsContentPage_notFound")}</EmptyTitle>
          </EmptyHeader>
        </Empty>
      ) : state.status === "failed" ? (
        <StatusLine
          tone="error"
          action={
            <Button variant="outline" onClick={retry}>
              {t("cmsContentPage_tryAgain")}
            </Button>
          }
        >
          {t("cmsContentPage_couldNotBeLoaded")}
        </StatusLine>
      ) : (
        <CmsPageBody page={state.page} />
      )}
    </main>
  );
}

function CmsPageBody({ page }: { page: CmsPage }) {
  return (
    <article className="flex flex-col gap-4">
      <h1 className="text-title-l text-balance break-words">{page.title}</h1>
      {page.subtitle ? (
        <p className="text-title-s text-muted-foreground text-pretty">{page.subtitle}</p>
      ) : null}
      {page.imageUrl ? (
        // A plain <img>: the CMS image host is not in `images.remotePatterns`, so
        // next/image would refuse it. The image is decorative; the title carries the meaning.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={page.imageUrl} alt="" className="max-h-80 w-full object-contain" />
      ) : null}
      {/* Shown as written until the markdown renderer lands (content_type to be confirmed). */}
      <div className="text-body whitespace-pre-wrap break-words">{page.content}</div>
    </article>
  );
}
