"use client";

import { BookmarkIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";

export function BookmarkButton({
  caseLabel,
  bookmarked,
  onToggle,
  className,
}: {
  caseLabel: string;
  bookmarked: boolean;
  onToggle: () => void;
  className?: string;
}) {
  const t = useTranslations();
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-pressed={bookmarked}
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
      className={cn("relative z-10", className)}
    >
      {/* size-5 in a size-10 button: the mark is the whole point of the control,
          and at the DS default 16px it disappeared into the row. */}
      <BookmarkIcon className={cn("size-5", bookmarked && "fill-current")} />
      <span className="sr-only">
        {bookmarked
          ? t("bookmarkButton_removeBookmarkFromCaseLabel", { caseLabel })
          : t("bookmarkButton_bookmarkCaseLabel", { caseLabel })}
      </span>
    </Button>
  );
}
