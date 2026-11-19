"use client";

import { PlayIcon } from "lucide-react";

import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Card, CardContent } from "@/components/ui/card";
import { LANGUAGE_NAME } from "@/lib/locale-config";
import { pick, ui, videos, type Locale, type StepId } from "@/lib/onboarding/content";

/**
 * Short explainer for the current step.
 *
 * One label, above the frame: the video's title *is* the question it answers, so a
 * separate "Watch this explained" line was two headings competing for the same job.
 *
 * The empty state is a first-class state, not an error — it is what a metered
 * connection or a blocked network gets, and nothing is lost, because no fact lives
 * only in video.
 */
export function VideoSlot({ step, locale }: { step: StepId; locale: Locale }) {
  const video = videos[step];

  return (
    <figure className="flex w-full min-w-0 flex-col gap-3">
      <Card className="gap-0 py-0">
        <CardContent className="p-0">
          <AspectRatio ratio={16 / 9} className="overflow-hidden bg-surface-sunken">
            {video.src ? (
              // Served by this app, never a video site (issue #44). Captions on by
              // default, as the old embed had them.
              <video
                className="size-full"
                src={video.src}
                aria-label={pick(video.title, locale)}
                controls
                preload="metadata"
                playsInline
              >
                {video.captions ? (
                  <track
                    kind="captions"
                    src={video.captions}
                    srcLang={locale}
                    label={LANGUAGE_NAME[locale]}
                    default
                  />
                ) : null}
              </video>
            ) : (
              <div className="flex size-full flex-col items-center justify-center gap-3 p-6 text-center">
                <span className="flex size-10 items-center justify-center rounded-full bg-background text-foreground ring-1 ring-border">
                  <PlayIcon className="size-4" aria-hidden />
                </span>
                <p className="text-body font-medium text-pretty text-foreground">
                  {pick(video.title, locale)}
                </p>
              </div>
            )}
          </AspectRatio>
        </CardContent>
      </Card>
      <figcaption className="text-body text-pretty text-muted-foreground">
        {pick(ui.videoUnavailable, locale)}
      </figcaption>
    </figure>
  );
}
