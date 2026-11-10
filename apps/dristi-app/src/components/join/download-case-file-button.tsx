"use client";
import {useTranslations as __useTranslations} from "@/i18n/use-translations";

import { DownloadIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * Compact download-case-file control for the review/details footer of both join
 * dialogs. Icon-only to keep the footer narrow; the label rides in a hover tooltip
 * and doubles as the accessible name.
 */
export function DownloadCaseFileButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  const __t = __useTranslations();
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={__t(label)}
            onClick={onClick}
          >
            <DownloadIcon aria-hidden />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{__t(label)}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
