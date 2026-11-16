"use client";

import { HistoryIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Identifier } from "@/components/chrome/identifier";
import type { PastCaseNumber } from "@/lib/cases/header";
import { formatCaseDate } from "@/lib/cases/types";
import { useTranslations } from "next-intl";

/**
 * The older numbers this case has carried (DET-02). Renders nothing when the
 * case has only ever had one number. The icon keeps the number line's height;
 * the `after:` inset gives it the 40px target.
 */
export function CaseNumberHistory({ history }: { history: PastCaseNumber[] }) {
  const t = useTranslations();
  if (history.length === 0) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={t("caseNumberHistory_earlierCaseNumbers")}
          className="relative size-6 text-muted-foreground after:absolute after:-inset-2"
        >
          <HistoryIcon aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 text-body-compact">
        <PopoverHeader className="border-b border-hairline pb-2">
          <PopoverTitle className="text-body-compact font-semibold">
            {t("caseNumberHistory_earlierCaseNumbers")}
          </PopoverTitle>
        </PopoverHeader>
        <ul className="flex flex-col gap-3">
          {history.map((entry) => (
            <li key={entry.number} className="flex flex-col gap-0.5">
              <Identifier
                value={entry.number}
                label={t("caseNumberHistory_earlierCaseNumber")}
                className="self-start text-caption font-medium text-foreground"
              />
              {entry.generatedOn ? (
                <span className="text-caption text-muted-foreground">
                  {t("caseNumberHistory_generatedOnFormatCaseDate", { formatCaseDate: formatCaseDate(entry.generatedOn) })}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
